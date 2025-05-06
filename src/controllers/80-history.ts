import type { Request } from 'express'
import { PrismaClient } from '@prisma/client'
import {
  Controller,
  Delete,
  Get,
  Path,
  Route,
  Security,
  Tags,
  Request as TsoaRequest,
} from 'tsoa'
import { err } from '../api.js'

const prisma = new PrismaClient()

interface HistoryResponse {
  id: string
  placeId: string
  createdAt: Date
}

interface AuthRequest extends Request {
  user?: { id: string }
}

@Route('user-history')
@Tags('History')
export class HistoryController extends Controller {
  @Get('/')
  @Security('auth')
  async getUserHistory(@TsoaRequest() req: AuthRequest): Promise<HistoryResponse[]> {
    const userId = req.user?.id
    if (!userId) {
      throw err(401, 'unauthorized')
    }

    const history = await prisma.userHistoryView.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    return history.map(h => ({
      id: h.id,
      placeId: h.placeId,
      createdAt: h.createdAt,
    }))
  }

  @Delete('/')
  @Security('auth')
  async deleteAllUserHistory(@TsoaRequest() req: AuthRequest): Promise<{ message: string }> {
    const userId = req.user?.id
    if (!userId) {
      throw err(401, 'unauthorized')
    }

    await prisma.userHistoryView.deleteMany({ where: { userId } })
    return { message: 'All history deleted.' }
  }

  @Delete('{historyId}')
  @Security('auth')
  async deleteHistoryById(
    @Path() historyId: string,
    @TsoaRequest() req: AuthRequest,
  ): Promise<{ message: string }> {
    const userId = req.user?.id
    if (!userId) {
      throw err(401, 'unauthorized')
    }

    const existing = await prisma.userHistoryView.findFirst({
      where: { id: historyId, userId },
    })

    if (!existing) {
      throw err(404, 'not-found')
    }

    await prisma.userHistoryView.delete({ where: { id: historyId } })
    return { message: 'History deleted.' }
  }
}
