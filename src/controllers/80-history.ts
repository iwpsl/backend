import type { AuthRequest } from '../middleware/auth.ts'
import { PrismaClient } from '@prisma/client'
import {
  Controller,
  Delete,
  Get,
  Path,
  Request,
  Route,
  Security,
  Tags,
} from 'tsoa'

const prisma = new PrismaClient()

interface HistoryItem {
  id: number
  type: 'calorie' | 'water' | 'step'
  date: Date
  details: any
}

@Route('user-history')
@Tags('User History')
export class HistoryController extends Controller {
  /**
   * Get full history (calorie, water, steps) for the logged-in user
   */
  @Get('/')
  @Security('auth')
  public async getAllHistory(@Request() req: AuthRequest): Promise<HistoryItem[]> {
    const userId = req.user!.id

    const [calories, waters, steps] = await Promise.all([
      prisma.calorieEntry.findMany({ where: { userId } }),
      prisma.waterEntry.findMany({ where: { userId } }),
      prisma.stepEntry.findMany({ where: { userId } }),
    ])

    const calorieHistory: HistoryItem[] = calories.map(entry => ({
      id: entry.id,
      type: 'calorie',
      date: entry.date,
      details: entry,
    }))

    const waterHistory: HistoryItem[] = waters.map(entry => ({
      id: entry.id,
      type: 'water',
      date: entry.date,
      details: entry,
    }))

    const stepHistory: HistoryItem[] = steps.map(entry => ({
      id: entry.id,
      type: 'step',
      date: entry.date,
      details: entry,
    }))

    const fullHistory = [...calorieHistory, ...waterHistory, ...stepHistory]
    return fullHistory.sort((a, b) => b.date.getTime() - a.date.getTime())
  }

  /**
   * Delete a single history entry by ID (calorie, water, or step)
   */
  @Delete('/{id}')
  @Security('auth')
  public async deleteHistoryById(
    @Request() req: AuthRequest,
    @Path() id: number,
  ): Promise<void> {
    const userId = req.user!.id

    const [calorie, water, step] = await Promise.all([
      prisma.calorieEntry.findFirst({ where: { id, userId } }),
      prisma.waterEntry.findFirst({ where: { id, userId } }),
      prisma.stepEntry.findFirst({ where: { id, userId } }),
    ])

    if (calorie) {
      await prisma.calorieEntry.delete({ where: { id } })
      return
    }

    if (water) {
      await prisma.waterEntry.delete({ where: { id } })
      return
    }

    if (step) {
      await prisma.stepEntry.delete({ where: { id } })
      return
    }

    this.setStatus(404)
    throw new Error('History entry not found')
  }

  /**
   * Delete all history entries (calorie, water, step) for the logged-in user
   */
  @Delete('/')
  @Security('auth')
  public async deleteAllHistory(@Request() req: AuthRequest): Promise<void> {
    const userId = req.user!.id

    await Promise.all([
      prisma.calorieEntry.deleteMany({ where: { userId } }),
      prisma.waterEntry.deleteMany({ where: { userId } }),
      prisma.stepEntry.deleteMany({ where: { userId } }),
    ])
  }
}
