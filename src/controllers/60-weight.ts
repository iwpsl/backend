import type { Api, UUID } from '../api.js'
import type { AuthRequest } from '../middleware/auth.js'
import { Body, Controller, Get, Middlewares, Post, Request, Route, Security, Tags } from 'tsoa'
import { err, ok } from '../api.js'
import { db } from '../db.js'
import { roleMiddleware } from '../middleware/role.js'
import { verifiedMiddleware } from '../middleware/verified.js'

interface WeightJournalData {
  id?: UUID
  date: Date
  weightKg: number
}

interface WeightJournalResultData extends WeightJournalData {
  id: UUID
}

@Route('weight')
@Tags('Weight')
@Security('auth')
@Middlewares(roleMiddleware('user'), verifiedMiddleware)
export class WeightController extends Controller {
  /** Create or update a journal entry. */
  @Post('/journal')
  public async postWeightJournal(
    @Request() req: AuthRequest,
    @Body() body: WeightJournalData,
  ): Api<WeightJournalResultData> {
    const userId = req.user!.id
    const { id, ...data } = body

    if (id) {
      return ok(await db.weightEntry.update({
        where: { id, userId, deletedAt: null },
        data,
      }))
    } else {
      return ok(await db.weightEntry.create({
        data: {
          userId,
          ...data,
        },
      }))
    }
  }

  @Get('/latest')
  public async getLatestWeight(
    @Request() req: AuthRequest,
  ): Api<WeightJournalData> {
    const userId = req.user!.id

    const res = await db.weightEntry.findFirst({
      where: { userId },
      orderBy: { date: 'desc' },
    })

    if (res) {
      return ok(res)
    }

    const profile = await db.profile.findUnique({
      where: { userId },
    })

    if (profile) {
      return ok({
        date: profile.createdAt,
        weightKg: profile.weightKg,
      })
    }

    return err(404, 'not-found')
  }
}
