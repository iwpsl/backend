import type { Api, UUID } from '../api.js'
import type { AuthRequest } from '../middleware/auth.js'
import { Controller, Get, Middlewares, Path, Post, Query, Request, Route, Security, Tags } from 'tsoa'
import { err, ok } from '../api.js'
import { db } from '../db.js'
import { roleMiddleware } from '../middleware/role.js'
import { verifiedMiddleware } from '../middleware/verified.js'
import { getDateOnly, reduceSum } from '../utils.js'

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

@Route('challenge')
@Tags('Challenge')
@Security('auth')
@Middlewares(roleMiddleware('user'), verifiedMiddleware)
export class ChallengeController extends Controller {
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

  @Post('/task/finish/{taskId}')
  public async finishTask(
    @Request() req: AuthRequest,
    @Path() taskId: UUID,
    @Query() v: boolean,
  ): Api {
    const userId = req.user!.id

    const task = await db.challengeTask.findUnique({
      where: {
        id: taskId,
      },
      include: {
        _count: {
          select: {
            finished: {
              where: {
                sub: { userId, finished: false },
              },
            },
          },
        },
        challenge: {
          include: {
            subs: { where: { userId, finished: false } },
          },
        },
      },
    })

    if (!task) {
      return err(404, 'not-found')
    }

    const wasFinished = task._count.finished > 0
    if (wasFinished === v) {
      return err(403, 'forbidden')
    }

    const sub = task.challenge.subs.at(0)
    if (!sub) {
      return err(403, 'forbidden')
    }

    if (v) {
      await db.finishedChallengeTask.delete({
        where: {
          subId_taskId: {
            subId: sub.id,
            taskId,
          },
        },
      })
    } else {
      await db.finishedChallengeTask.create({
        data: {
          subId: sub.id,
          taskId,
        },
      })
    }

    return ok()
  }
}
