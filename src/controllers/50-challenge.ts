import type { Api, UUID } from '../api.js'
import type { AuthRequest } from '../middleware/auth.js'
import { Controller, Get, Middlewares, Path, Post, Request, Route, Security, Tags } from 'tsoa'
import { err, ok } from '../api.js'
import { db } from '../db.js'
import { roleMiddleware } from '../middleware/role.js'
import { verifiedMiddleware } from '../middleware/verified.js'
import { baseUrl, df, getDateOnly, reduceSum } from '../utils.js'

interface ChallengeData {
  id: UUID
  title: string
  description: string
  imageUrl: string
  taskCount: number
  joined: boolean
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
          where: { userId, finished: false },
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
      imageUrl: it.imageUrl,
      taskCount: it._count.tasks,
      joined: it.subs.at(0) !== undefined,
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
        _count: {
          select: { subs: { where: { userId, finished: false } } },
        },
        tasks: {
          include: {
            _count: {
              select: {
                finished: { where: { sub: { userId, finished: false } } },
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
      imageUrl: res.imageUrl,
      taskCount: res.tasks.length,
      joined: res._count.subs > 0,
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
          select: { subs: { where: { userId, finished: false } } },
        },
      },
    })

    if (!challenge) {
      return err(404, 'not-found')
    }

    if (challenge._count.subs > 0) {
      return err(403, 'forbidden')
    }

    await db.challengeSubscription.create({
      data: {
        userId,
        challengeId: challenge.id,
        startDate: getDateOnly(new Date()),
      },
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
              sub: { userId, finished: false },
            },
          },
        } },
        challenge: {
          include: {
            _count: { select: { tasks: true } },
            subs: {
              where: { userId, finished: false },
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
    if (!sub || task._count.finished > 0) {
      return err(403, 'forbidden')
    }

    const dayDiff = df.differenceInDays(getDateOnly(new Date()), sub.startDate)
    if (dayDiff !== task.day) {
      return err(403, 'forbidden')
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

      // also finish the sub if it is the last task
      if (sub._count.finishedTasks === (task.challenge._count.tasks - 1)) {
        await tx.challengeSubscription.update({
          where: { id: sub.id },
          data: { finished: true },
        })
      }
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

    console.log(res)

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
}
