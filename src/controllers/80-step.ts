import type { Api, UUID } from '../api.js'
import type { AuthRequest } from '../middleware/auth.js'
import { Body, Controller, Delete, Get, Middlewares, Path, Post, Query, Request, Route, Security, Tags } from 'tsoa'
import { err, ok } from '../api.js'
import { db } from '../db.js'
import { roleMiddleware } from '../middleware/role.js'
import { verifiedMiddleware } from '../middleware/verified.js'
import { getDateOnly } from '../utils.js'

interface StepJournalData {
  id?: UUID
  date: Date
  steps: number
  distanceKm: number
  activeMinutes: number
}

interface StepTargetData {
  steps: number
  distanceKm: number
}

interface StepJournalResultData extends StepJournalData {
  id: UUID
}

interface DailyStepJournalData extends StepJournalResultData {
  target: StepTargetData
}

@Route('step')
@Tags('Step')
@Security('auth')
@Middlewares(roleMiddleware('user'), verifiedMiddleware)
export class StepController extends Controller {
  /** Create or update a journal entry. */
  @Post('/journal')
  public async postStepJournal(
    @Request() req: AuthRequest,
    @Body() body: StepJournalData,
  ): Api<StepJournalResultData> {
    const userId = req.user!.id
    const { id, date, ...data } = body
    const dateOnly = getDateOnly(date)

    let res: StepJournalResultData
    if (body.id) {
      res = await db.stepEntry.update({
        where: { id, userId, deletedAt: null },
        data: {
          date: dateOnly,
          ...data,
        },
      })
    } else {
      const latestTarget = await db.stepTarget.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      })

      if (!latestTarget) {
        throw new Error('No target')
      }

      res = await db.stepEntry.create({
        data: {
          userId,
          targetId: latestTarget.id,
          date: dateOnly,
          ...data,
        },
      })
    }

    return ok(res)
  }

  /** Delete a journal entry. */
  @Delete('/journal/id/{id}')
  public async deleteStepJournal(
    @Request() req: AuthRequest,
    @Path() id: UUID,
  ): Api {
    const userId = req.user!.id

    await db.stepEntry.update({
      where: { id, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    })

    return ok()
  }

  /** Get a list of journal entries. */
  @Get('/journal')
  public async getStepJournals(
    @Request() req: AuthRequest,
    @Query() after?: UUID,
  ): Api<StepJournalResultData[]> {
    const userId = req.user!.id

    const res = after
      ? await db.stepEntry.findMany({
        take: 10,
        skip: 1,
        cursor: { id: after },
        where: { userId },
        orderBy: { createdAt: 'asc' },
      })
      : await db.stepEntry.findMany({
        take: 10,
        where: { userId },
        orderBy: { createdAt: 'asc' },
      })

    return ok(res.map((it) => {
      const { userId, ...rest } = it
      return rest
    }))
  }

  /** Get detail of a journal entry. */
  @Get('/journal/{id}')
  public async getStepJournalById(
    @Request() req: AuthRequest,
    @Path() id: UUID,
  ): Api<StepJournalResultData> {
    const res = await db.stepEntry.findUnique({
      where: {
        id,
        userId: req.user!.id,
      },
    })

    if (!res) {
      return err(404, 'not-found')
    }

    return ok(res)
  }

  /** Get entry by date. */
  @Get('/journal/date/{date}')
  public async getStepJournalByDate(
    @Request() req: AuthRequest,
    @Path() date: Date,
  ): Api<DailyStepJournalData> {
    const userId = req.user!.id
    const dateOnly = getDateOnly(date)

    const res = await db.stepEntry.findUnique({
      where: {
        userId_date: {
          userId,
          date: dateOnly,
        },
      },
      include: {
        target: true,
      },
    })

    if (!res) {
      return err(404, 'not-found')
    }

    return ok({
      id: res.id,
      steps: res.steps,
      date: res.date,
      activeMinutes: res.activeMinutes,
      distanceKm: res.distanceKm,
      target: {
        steps: res.target.steps,
        distanceKm: res.target.distanceKm,
      },
    })
  }

  /** Get latest target. */
  @Get('/target/latest')
  public async getLatestStepTarget(
    @Request() req: AuthRequest,
  ): Api<StepTargetData> {
    const userId = req.user!.id

    const res = await db.stepTarget.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    if (!res) {
      return err(404, 'not-found')
    }

    return ok(res)
  }

  /** Insert a new target. */
  @Post('/target')
  public async createStepTarget(
    @Request() req: AuthRequest,
    @Body() body: StepTargetData,
  ): Api {
    const userId = req.user!.id

    const target = await db.stepTarget.create({
      data: {
        userId,
        ...body,
      },
    })

    const todayEntry = await db.stepEntry.findUnique({
      where: {
        userId_date: {
          userId,
          date: getDateOnly(new Date()),
        },
      },
    })

    if (todayEntry) {
      await db.stepEntry.update({
        where: { id: todayEntry.id },
        data: { targetId: target.id },
      })
    }

    return ok()
  }
}
