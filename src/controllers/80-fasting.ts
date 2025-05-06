import type { FastingEntry } from '@prisma/client'
import type { Api, UUID } from '../api.js'
import type { FastingCategory } from '../db.js'
import type { AuthRequest } from '../middleware/auth.js'
import { Body, Controller, Delete, Get, Middlewares, Path, Post, Query, Request, Route, Security, Tags } from 'tsoa'
import { err, ok } from '../api.js'
import { cleanUpdateAttrs, db } from '../db.js'
import { roleMiddleware } from '../middleware/role.js'
import { verifiedMiddleware } from '../middleware/verified.js'
import { df, getDateOnly, nullArray } from '../utils.js'
import { enqueueWork } from '../worker/queue.js'

interface FastingData {
  category: FastingCategory
  startTime: Date
  endTime: Date
  finishedAt: Date | null
}

interface FastingResultData extends FastingData {
  id?: UUID
}

interface WeeklyFastingData {
  maxStreak: number
  commonCategory?: FastingCategory
  entries: (FastingResultData | null)[]
}

function clean(res: FastingEntry): FastingResultData {
  const { userId, ...rest } = cleanUpdateAttrs(res)
  return rest
}

@Route('fasting')
@Tags('Fasting')
@Security('auth')
@Middlewares(roleMiddleware('user'), verifiedMiddleware)
export class FastingController extends Controller {
  /** Create a new fasting entry. */
  @Post('/start')
  public async createFasting(
    @Request() req: AuthRequest,
    @Body() body: FastingResultData,
  ): Api<FastingResultData> {
    const userId = req.user!.id

    const res = await db.fastingEntry.create({
      data: {
        userId,
        ...body,
      },
    })

    await enqueueWork(
      res.endTime,
      'fastingFinisher',
      { id: res.id, finishedAt: res.endTime },
    )

    return ok(res)
  }

  /** Get the current running fasting entry. */
  @Get('/current')
  public async getCurrentFasting(
    @Request() req: AuthRequest,
  ): Api<FastingResultData> {
    const userId = req.user!.id

    const res = await db.fastingEntry.findFirst({
      where: {
        userId,
        finishedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    if (!res) {
      return err(404, 'not-found')
    }

    return ok(res)
  }

  /** Manually finish the specified fasting entry. */
  @Post('/finish/{id}')
  public async finishFasting(
    @Request() req: AuthRequest,
    @Path() id: UUID,
  ): Api {
    const userId = req.user!.id

    await db.fastingEntry.update({
      where: { id, userId, finishedAt: null, deletedAt: null },
      data: { finishedAt: new Date() },
    })

    return ok()
  }

  /** Get a list of journal entries. */
  @Get('/journal')
  public async getFastingJournals(
    @Request() req: AuthRequest,
    @Query() after?: UUID,
  ): Api<FastingResultData[]> {
    const userId = req.user!.id

    const res = after
      ? await db.fastingEntry.findMany({
        take: 10,
        skip: 1,
        cursor: { id: after },
        where: { userId },
        orderBy: { createdAt: 'asc' },
      })
      : await db.fastingEntry.findMany({
        take: 10,
        where: { userId },
        orderBy: { createdAt: 'asc' },
      })

    return ok(res.map(clean))
  }

  /** Delete a journal entry. */
  @Delete('/journal/id/{id}')
  public async deleteFastingJournal(
    @Request() req: AuthRequest,
    @Path() id: UUID,
  ): Api {
    const userId = req.user!.id

    await db.fastingEntry.update({
      where: { id, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    })

    return ok()
  }

  /** Get weekly data. */
  @Get('/journal/weekly/{startDate}')
  public async getWeeklyFastingJournal(
    @Request() req: AuthRequest,
    @Path() startDate: Date,
  ): Api<WeeklyFastingData> {
    const userId = req.user!.id
    const startDateOnly = getDateOnly(startDate)
    const endDateOnly = df.addDays(startDate, 7)

    const res = await db.fastingEntry.findMany({
      where: {
        userId,
        startTime: {
          gte: startDateOnly,
          lt: endDateOnly,
        },
        finishedAt: {
          gte: db.fastingEntry.fields.endTime,
        },
      },
      orderBy: {
        startTime: 'asc',
      },
    })

    const categoryCount: Partial<Record<FastingCategory, number>> = {}
    const entries = nullArray<FastingResultData>(7)
    for (const item of res) {
      const index = df.differenceInDays(item.startTime, startDateOnly)
      if (index >= 0 && index < 7) {
        entries[index] = item
        categoryCount[item.category] = (categoryCount[item.category] ?? 0) + 1
      }
    }

    let maxStreak = 0
    let currentStreak = 0
    for (const entry of entries) {
      if (entry) {
        currentStreak++
        maxStreak = Math.max(maxStreak, currentStreak)
      } else {
        currentStreak = 0
      }
    }

    const commonCategory = Object.entries(categoryCount).reduce(
      (max, [category, count]) => count > max.count ? { category: category as FastingCategory, count } : max,
      { category: undefined as FastingCategory | undefined, count: -Infinity },
    )

    return ok({
      maxStreak,
      commonCategory: commonCategory.category,
      entries,
    })
  }
}
