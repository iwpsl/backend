import type { WaterEntry } from '@prisma/client'
import type { Api, UUID } from '../api.js'
import type { AuthRequest } from '../middleware/auth.js'
import { Body, Controller, Delete, Get, Middlewares, Path, Post, Query, Request, Route, Security, Tags } from 'tsoa'
import { err, ok } from '../api.js'
import { cleanUpdateAttrs, db } from '../db.js'
import { roleMiddleware } from '../middleware/role.js'
import { verifiedMiddleware } from '../middleware/verified.js'

interface WaterJournalData {
  id?: UUID
  date: Date
  amountMl: number
}

interface WaterJournalResultData extends WaterJournalData {
  id: UUID
}

function clean(res: WaterEntry) {
  const { userId, ...rest } = cleanUpdateAttrs(res)
  return rest
}

@Route('water')
@Tags('Water')
@Security('auth')
@Middlewares(roleMiddleware('USER'), verifiedMiddleware)
export class WaterController extends Controller {
  /** Create or update a water intake entry. */
  @Post('/journal')
  public async postWaterJournal(
    @Request() req: AuthRequest,
    @Body() body: WaterJournalData,
  ): Api {
    const userId = req.user!.id
    const { id, date, ...data } = body
    const dateOnly = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())

    if (body.id) {
      await db.waterEntry.update({
        where: { id, userId, deletedAt: null },
        data: {
          date: dateOnly,
          ...data,
        },
      })
    } else {
      await db.waterEntry.create({
        data: {
          userId,
          date: dateOnly,
          ...data,
        },
      })
    }

    return ok()
  }

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

    if (!res)
      return err(404, 'not-found')

    return ok(clean(res))
  }

  /** Get entry by date. */
  @Get('/journal/date/{date}')
  public async getWaterJournalByDate(
    @Request() req: AuthRequest,
    @Path() date: Date,
  ): Api<WaterJournalResultData> {
    const userId = req.user!.id
    const dateOnly = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())

    const res = await db.waterEntry.findUnique({
      where: {
        userId_date: {
          userId,
          date: dateOnly,
        },
      },
    })

    if (!res)
      return err(404, 'not-found')

    return ok(clean(res))
  }
}
