import type { Api } from '../api'
import type { AuthRequest } from '../middleware/auth'
import { Body, Controller, Get, Middlewares, Path, Post, Query, Request, Route, Security, Tags } from 'tsoa'
import { err, ok } from '../api'
import { roleMiddleware } from '../middleware/role'
import { verifiedMiddleware } from '../middleware/verified'
import { prisma } from '../utils'

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
  @Get('/journal/{id}')
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
}
