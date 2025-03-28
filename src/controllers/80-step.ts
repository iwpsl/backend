import type { Api } from '../api.js'
import type { AuthRequest } from '../middleware/auth.js'
import { Body, Controller, Get, Middlewares, Path, Post, Query, Request, Route, Security, Tags } from 'tsoa'
import { err, ok } from '../api.js'
import { role } from '../middleware/role.js'
import { verified } from '../middleware/verified.js'
import { prisma } from '../utils.js'

interface StepJournalData {
  id?: number
  date: Date
  steps: number
}

interface StepJournalResultData extends StepJournalData {
  id: number
}

@Route('step')
@Tags('Step')
@Security('auth')
@Middlewares(role('USER'), verified)
export class StepController extends Controller {
  /** Create or update a journal entry. */
  @Post('/journal')
  public async postStepJournal(
    @Request() req: AuthRequest,
    @Body() body: StepJournalData,
  ): Api {
    const userId = req.user!.id
    const { id, ...data } = body

    if (body.id) {
      await prisma.stepEntry.update({
        where: { id },
        data: {
          userId,
          ...data,
        },
      })
    } else {
      await prisma.stepEntry.create({
        data: {
          userId,
          ...data,
        },
      })
    }

    return ok()
  }

  /** Get a list of journal entries. */
  @Get('/journal')
  public async getStepJournals(
    @Request() req: AuthRequest,
    @Query() after?: number,
  ): Api<StepJournalResultData[]> {
    const userId = req.user!.id

    const res = after
      ? await prisma.stepEntry.findMany({
        take: 10,
        skip: 1,
        cursor: { id: after },
        where: { userId },
      })
      : await prisma.stepEntry.findMany({
        take: 10,
        where: { userId },
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
    @Path() id: number,
  ): Api<StepJournalResultData> {
    const res = await prisma.stepEntry.findUnique({
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
