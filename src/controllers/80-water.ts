import type { WaterEntry } from '@prisma/client'
import type { Api, UUID } from '../api.js'
import type { AuthRequest } from '../middleware/auth.js'
import { Body, Controller, Delete, Get, Middlewares, Path, Post, Query, Request, Route, Security, Tags } from 'tsoa'
import { err, ok } from '../api.js'
import { cleanUpdateAttrs, db } from '../db.js'
import { roleMiddleware } from '../middleware/role.js'
import { verifiedMiddleware } from '../middleware/verified.js'
import { getDateOnly } from '../utils.js'

interface WaterJournalData {
  id?: UUID
  date: Date
  amountMl: number
}

interface WaterTargetData {
  amountMl: number
}

interface WaterJournalResultData extends WaterJournalData {
  id: UUID
}

interface DailyWaterJournalData extends WaterJournalResultData {
  target: WaterTargetData
}

function clean(res: WaterEntry) {
  const { userId, ...rest } = cleanUpdateAttrs(res)
  return rest
}

@Route('water')
@Tags('Water')
@Security('auth')
@Middlewares(roleMiddleware('user'), verifiedMiddleware)
export class WaterController extends Controller {
  /** Create or update a water intake entry. */
  @Post('/journal')
  public async postWaterJournal(
    @Request() req: AuthRequest,
    @Body() body: WaterJournalData,
  ): Api<WaterJournalResultData> {
    const userId = req.user!.id
    const { id, date, ...data } = body
    const dateOnly = getDateOnly(date)

    let res: WaterJournalResultData
    if (body.id) {
      res = await db.waterEntry.update({
        where: { id, userId, deletedAt: null },
        data: {
          date: dateOnly,
          ...data,
        },
      })
    } else {
      const latestTarget = await db.waterTarget.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      })

      if (!latestTarget) {
        throw new Error('No target')
      }

      res = await db.waterEntry.create({
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
  public async deleteWaterJournal(
    @Request() req: AuthRequest,
    @Path() id: UUID,
  ): Api {
    const userId = req.user!.id

    await db.waterEntry.update({
      where: { id, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    })

    return ok()
  }

  /** Get a list of water intake entries. */
  @Get('/journal')
  public async getWaterJournals(
    @Request() req: AuthRequest,
    @Query() after?: UUID,
  ): Api<WaterJournalResultData[]> {
    const userId = req.user!.id

    const res = after
      ? await db.waterEntry.findMany({
        take: 10,
        skip: 1,
        cursor: { id: after },
        where: { userId },
        orderBy: { createdAt: 'asc' },
      })
      : await db.waterEntry.findMany({
        take: 10,
        where: { userId },
        orderBy: { createdAt: 'asc' },
      })

    return ok(res.map(clean))
  }

  /** Get detail of a water intake entry. */
  @Get('/journal/id/{id}')
  public async getWaterJournalById(
    @Request() req: AuthRequest,
    @Path() id: UUID,
  ): Api<WaterJournalResultData> {
    const res = await db.waterEntry.findUnique({
      where: {
        id,
        userId: req.user!.id,
      },
    })

    if (!res) {
      return err(404, 'not-found')
    }

    return ok(clean(res))
  }

  /** Get entry by date. */
  @Get('/journal/date/{date}')
  public async getWaterJournalByDate(
    @Request() req: AuthRequest,
    @Path() date: Date,
  ): Api<DailyWaterJournalData> {
    const userId = req.user!.id
    const dateOnly = getDateOnly(date)

    const res = await db.waterEntry.findUnique({
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
      amountMl: res.amountMl,
      date: res.date,
      target: {
        amountMl: res.target.amountMl,
      },
    })
  }

  /** Get latest target. */
  @Get('/target/latest')
  public async getLatestWaterTarget(
    @Request() req: AuthRequest,
  ): Api<WaterTargetData> {
    const userId = req.user!.id

    const res = await db.waterTarget.findFirst({
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
  public async createWaterTarget(
    @Request() req: AuthRequest,
    @Body() body: WaterTargetData,
  ): Api {
    const userId = req.user!.id

    const target = await db.waterTarget.create({
      data: {
        userId,
        ...body,
      },
    })

    const todayEntry = await db.waterEntry.findUnique({
      where: {
        userId_date: {
          userId,
          date: getDateOnly(new Date()),
        },
      },
    })

    if (todayEntry) {
      await db.waterEntry.update({
        where: { id: todayEntry.id },
        data: { targetId: target.id },
      })
    }

    return ok()
  }
}
