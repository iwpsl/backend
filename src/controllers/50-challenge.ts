import type { ChallengeCategory } from '@prisma/client'
import type { Api, UUID } from '../api.js'
import type { AuthRequest } from '../middleware/auth.js'
import { Controller, Get, Middlewares, Path, Post, Request, Route, Security, Tags } from 'tsoa'
import { err, ok } from '../api.js'
import { db } from '../db.js'
import { roleMiddleware } from '../middleware/role.js'
import { verifiedMiddleware } from '../middleware/verified.js'
import { baseUrl, df, getDateOnly, reduceSum } from '../utils.js'
import { enqueueWork } from '../worker/queue.js'

interface ChallengeData {
  id: UUID
  title: string
  description: string
  category: ChallengeCategory
  taskCount: number
  startDate: Date | null
  progress: number
}

interface ChallengeTask {
  id: UUID
  description: string
  day: number
  finished: boolean
}

interface ChallengeDetailsData extends ChallengeData {
  tasks: ChallengeTask[]
}

interface XpData {
  xp: number
  rank: number
}

interface RankingData extends XpData {
  userId: UUID
  name: string
  avatarUrl: string
}

@Route('challenge')
@Tags('Challenge')
@Security('auth')
@Middlewares(roleMiddleware('user'), verifiedMiddleware)
export class ChallengeController extends Controller {
  /** Get all available challenges */
  @Get('/all')
  public async getChallenges(
    @Request() req: AuthRequest,
  ): Api<ChallengeData[]> {
    const userId = req.user!.id

    const res = await db.challenge.findMany({
      where: { deletedAt: null },
      include: {
        _count: { select: { tasks: true } },
        subs: {
          where: { userId, finishedAt: null },
          include: {
            _count: { select: { finishedTasks: true } },
          },
        },
      },
    })

    return ok(res.map(it => ({
      id: it.id,
      title: it.title,
      description: it.description,
      category: it.category,
      taskCount: it._count.tasks,
      startDate: it.subs.at(0)?.startDate ?? null,
      progress: it.subs.at(0)?._count?.finishedTasks ?? 0,
    })),
    )
  }

  /** Get challenge details such as tasks */
  @Get('/details/{challengeId}')
  public async getChallengeDetails(
    @Request() req: AuthRequest,
    @Path() challengeId: UUID,
  ): Api<ChallengeDetailsData> {
    const userId = req.user!.id

    const res = await db.challenge.findUnique({
      where: {
        id: challengeId,
        deletedAt: null,
      },
      include: {
        subs: {
          where: { userId, finishedAt: null },
        },
        tasks: {
          include: {
            _count: {
              select: {
                finished: { where: { sub: { userId, finishedAt: null } } },
              },
            },
          },
          orderBy: {
            day: 'asc',
          },
        },
      },
    })

    if (!res) {
      return err(404, 'not-found')
    }

    const progress = reduceSum(res.tasks, it => it._count.finished > 0 ? 1 : 0)

    return ok({
      id: res.id,
      title: res.title,
      description: res.description,
      category: res.category,
      taskCount: res.tasks.length,
      startDate: res.subs.at(0)?.startDate ?? null,
      progress,
      tasks: res.tasks.map(it => ({
        id: it.id,
        day: it.day,
        description: it.description,
        finished: it._count.finished > 0,
      })),
    })
  }

  /** Join a challenge */
  @Post('/join/{challengeId}')
  public async joinChallenge(
    @Request() req: AuthRequest,
    @Path() challengeId: UUID,
  ): Api {
    const userId = req.user!.id

    const challenge = await db.challenge.findUnique({
      where: {
        id: challengeId,
        deletedAt: null,
      },
      include: {
        _count: {
          select: { subs: { where: { userId, finishedAt: null } } },
        },
      },
    })

    if (!challenge) {
      return err(404, 'not-found')
    }

    if (challenge._count.subs > 0) {
      return err(403, 'challenge-already-joined')
    }

    const startDate = getDateOnly(new Date())
    const sub = await db.challengeSubscription.create({
      data: {
        userId,
        challengeId: challenge.id,
        startDate,
      },
    })

    const challengeLength = await db.challengeTask.aggregate({
      _max: { day: true },
      where: { challengeId: challenge.id },
    })

    enqueueWork(
      df.addDays(startDate, challengeLength._max.day!),
      'challengeFinisher',
      { id: sub.id },
    )

    return ok()
  }

  /** Leave a challenge. */
  @Post('/task/leave/{challengeId}')
  public async leaveChallenge(
    @Request() req: AuthRequest,
    @Path() challengeId: UUID,
  ): Api {
    const userId = req.user!.id

    const challenge = await db.challenge.findUnique({
      where: { id: challengeId, deletedAt: null },
      include: {
        subs: {
          where: { userId, finishedAt: null },
          orderBy: { startDate: 'desc' },
          take: 1,
        },
      },
    })

    if (!challenge) {
      return err(404, 'not-found')
    }

    if (challenge.subs.length === 0) {
      return err(403, 'challenge-not-joined')
    }

    await db.challengeSubscription.update({
      where: { id: challenge.subs[0].id },
      data: { finishedAt: getDateOnly(new Date()) },
    })

    return ok()
  }

  /** Unfinish a challenge task */
  @Post('/task/unfinish/{taskId}')
  public async unfinishTask(
    @Request() req: AuthRequest,
    @Path() taskId: UUID,
  ): Api {
    const userId = req.user!.id

    const task = await db.challengeTask.findUnique({
      where: {
        id: taskId,
      },
      include: {
        _count: { select: {
          finished: {
            where: {
              sub: { userId, finishedAt: null },
            },
          },
        } },
        challenge: {
          include: {
            _count: { select: { tasks: true } },
            subs: {
              where: { userId, finishedAt: null },
              include: {
                _count: { select: { finishedTasks: true } },
              },
            },
          },
        },
      },
    })

    if (!task) {
      return err(404, 'not-found')
    }

    const sub = task.challenge.subs.at(0)
    if (!sub) {
      return err(403, 'challenge-not-joined')
    }

    if (task._count.finished === 0) {
      return err(403, 'task-not-finished')
    }

    const dayDiff = df.differenceInDays(getDateOnly(new Date()), sub.startDate)
    if (dayDiff !== task.day) {
      return err(403, 'task-wrong-day')
    }

    await db.$transaction(async (tx) => {
      await tx.finishedChallengeTask.delete({
        where: { subId_taskId: {
          subId: sub.id,
          taskId,
        } },
      })

      await tx.user.update({
        where: { id: userId },
        data: {
          xp: { decrement: 10 },
        },
      })
    })

    return ok()
  }

  /** Finish a challenge task */
  @Post('/task/finish/{taskId}')
  public async finishTask(
    @Request() req: AuthRequest,
    @Path() taskId: UUID,
  ): Api {
    const userId = req.user!.id

    const task = await db.challengeTask.findUnique({
      where: {
        id: taskId,
      },
      include: {
        _count: { select: {
          finished: {
            where: {
              sub: { userId, finishedAt: null },
            },
          },
        } },
        challenge: {
          include: {
            _count: { select: { tasks: true } },
            subs: {
              where: { userId, finishedAt: null },
              include: {
                _count: { select: { finishedTasks: true } },
              },
            },
          },
        },
      },
    })

    if (!task) {
      return err(404, 'not-found')
    }

    const sub = task.challenge.subs.at(0)
    if (!sub) {
      return err(403, 'challenge-not-joined')
    }

    if (task._count.finished > 0) {
      return err(403, 'task-already-finished')
    }

    const dayDiff = df.differenceInDays(getDateOnly(new Date()), sub.startDate)
    if (dayDiff !== task.day) {
      return err(403, 'task-wrong-day')
    }

    await db.$transaction(async (tx) => {
      await tx.finishedChallengeTask.create({
        data: {
          subId: sub.id,
          taskId,
        },
      })

      await tx.user.update({
        where: { id: userId },
        data: {
          xp: { increment: 10 },
        },
      })
    })

    return ok()
  }

  /** Get user xp */
  @Get('/xp')
  public async getXp(
    @Request() req: AuthRequest,
  ): Api<XpData> {
    const userId = req.user!.id

    // yuck
    const res = await db.$queryRaw`
      SELECT xp, rank FROM (
        SELECT id,
               ROW_NUMBER() OVER (ORDER BY xp DESC) AS rank,
               xp
        FROM "User"
      ) AS ranked_users
      WHERE id = ${userId}::uuid;
    ` as { xp: number, rank: bigint }[]

    return ok({
      xp: res.at(0)?.xp ?? 0,
      rank: Number(res.at(0)?.rank) ?? 0,
    })
  }

  /** Get current top 50 users */
  @Get('/rank/global')
  public async getGlobalRanking(): Api<RankingData[]> {
    const ranking = await db.user.findMany({
      where: { profile: { isNot: null } },
      include: { profile: true },
      orderBy: { xp: 'desc' },
      take: 50,
    })

    return ok(ranking.map((it, i) => ({
      userId: it.id,
      name: it.profile!.name,
      avatarUrl: `${baseUrl}/avatars/${it.id}.jpg`,
      xp: it.xp,
      rank: i + 1,
    })))
  }

  /** Get friends ranking */
  @Get('/rank/friends')
  public async getFriendsRanking(
    @Request() req: AuthRequest,
  ): Api<RankingData[]> {
    const userId = req.user!.id
    const ranking = await db.user.findMany({
      where: {
        profile: { isNot: null },
        OR: [
          { id: userId },
          { connectionA: { some: { bId: userId } } },
          { connectionB: { some: { aId: userId } } },
        ],
      },
      include: { profile: true },
      orderBy: { xp: 'desc' },
    })

    return ok(ranking.map((it, i) => ({
      userId: it.id,
      name: it.profile!.name,
      avatarUrl: `${baseUrl}/avatars/${it.id}.jpg`,
      xp: it.xp,
      rank: i + 1,
    })))
  }
}
