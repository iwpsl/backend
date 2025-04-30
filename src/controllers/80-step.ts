import type { Api, UUID } from '../api.js'
import type { AuthRequest } from '../middleware/auth.js'
import { Body, Controller, Delete, Get, Middlewares, Path, Post, Query, Request, Route, Security, Tags } from 'tsoa'
import { err, ok } from '../api.js'
import { db } from '../db.js'
import { roleMiddleware } from '../middleware/role.js'
import { verifiedMiddleware } from '../middleware/verified.js'
import { df, getDateOnly, reduceAvg } from '../utils.js'

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

interface StepSumData {
  steps: number
  distanceKm: number
  activeMinutes: number
}

interface WeeklyStepJournalData {
  entries: (StepJournalData | null)[]
  average: StepSumData
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
  ): Api {
    const userId = req.user!.id
    const { id, date, ...data } = body
    const dateOnly = getDateOnly(date)

    if (body.id) {
      await db.stepEntry.update({
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

      await db.stepEntry.create({
        data: {
          userId,
          targetId: latestTarget.id,
          date: dateOnly,
          ...data,
        },
      })
    }

    return ok()
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

  /** Get weekly data. */
  @Get('/journal/weekly/{startDate}')
  public async getWeeklyStepJournal(
    @Request() req: AuthRequest,
    @Path() startDate: Date,
  ): Api<WeeklyStepJournalData> {
    const userId = req.user!.id
    const startDateOnly = getDateOnly(startDate)
    const endDateOnly = df.addDays(startDate, 7)

    const res = await db.stepEntry.findMany({
      where: {
        userId,
        date: {
          gte: startDateOnly,
          lt: endDateOnly,
        },
      },
      include: {
        target: true,
      },
    })

    const entries: WeeklyStepJournalData['entries'] = Array.from({ length: 7 }, () => null)

    for (const item of res) {
      const index = df.differenceInDays(item.date, startDateOnly)
      if (index >= 0 && index < 7) {
        entries[index] = item
      }
    }

    return ok({
      average: {
        steps: reduceAvg(res, it => it.steps),
        distanceKm: reduceAvg(res, it => it.distanceKm),
        activeMinutes: reduceAvg(res, it => it.activeMinutes),
      },
      entries,
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
