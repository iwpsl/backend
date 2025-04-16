import type { Api } from '../api.js'
import type { AuthRequest } from '../middleware/auth.js'
import { Body, Controller, Get, Middlewares, Path, Post, Query, Request, Route, Security, Tags } from 'tsoa'
import { err, ok } from '../api.js'
import { roleMiddleware } from '../middleware/role.js'
import { verifiedMiddleware } from '../middleware/verified.js'
import { prisma } from '../utils.js'

interface WaterJournalData {
  id?: number
  date: Date
  amountMl: number
}

interface WaterJournalResultData extends WaterJournalData {
  id: number
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
    const { id, ...data } = body

    if (body.id) {
      await prisma.waterEntry.update({
        where: { id },
        data: {
          userId,
          ...data,
        },
      })
    } else {
      await prisma.waterEntry.create({
        data: {
          userId,
          ...data,
        },
      })
    }

    return ok()
  }

  /** Get a list of water intake entries. */
  @Get('/journal')
  public async getWaterJournals(
    @Request() req: AuthRequest,
    @Query() after?: number,
  ): Api<WaterJournalResultData[]> {
    const userId = req.user!.id

    const res = after
      ? await prisma.waterEntry.findMany({
        take: 10,
        skip: 1,
        cursor: { id: after },
        where: { userId },
      })
      : await prisma.waterEntry.findMany({
        take: 10,
        where: { userId },
      })

    return ok(res.map(({ userId, ...rest }) => rest))
  }

  /** Get detail of a water intake entry. */
  @Get('/journal/id/{id}')
  public async getWaterJournalById(
    @Request() req: AuthRequest,
    @Path() id: number,
  ): Api<WaterJournalResultData> {
    const res = await prisma.waterEntry.findUnique({
      where: {
        id,
        userId: req.user!.id,
      },
    })

    if (!res)
      return err(404, 'not-found')

    return ok(res)
  }

  /** Get entry by date. */
  @Get('/journal/date/{date}')
  public async getCalorieJournalByDate(
    @Request() req: AuthRequest,
    @Path() date: Date,
  ): Api<WaterJournalResultData> {
    const userId = req.user!.id
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())

    const res = await prisma.waterEntry.findUnique({
      where: {
        userId_date: {
          userId,
          date: dateOnly,
        },
      },
    })

    if (!res)
      return err(404, 'not-found')

    return ok(res)
  }
}
