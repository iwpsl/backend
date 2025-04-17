import { Controller, Get, Path, Query, Route, Tags } from 'tsoa'
import { prisma } from '../utils.js'

// === INTERFACES (instead of Prisma models) ===

interface CalorieHistory {
  type: 'CALORIE'
  id: number
  date: Date
  food: string
  mealType: string
  energyKcal: number
}

interface WaterHistory {
  type: 'WATER'
  id: number
  date: Date
  amountMl: number
}

interface StepHistory {
  type: 'STEP'
  id: number
  date: Date
  steps: number
}

type HistoryItem = CalorieHistory | WaterHistory | StepHistory

interface UserHistoryResponse {
  userId: string
  history: HistoryItem[]
}

// === CONTROLLER ===

@Route('user-history')
@Tags('History')
export class HistoryController extends Controller {
  /**
   * Get unified user history: calories, water, and steps
   */
  @Get('{userId}')
  public async getUserHistory(
    @Path() userId: string,
    @Query() startDate?: string,
    @Query() endDate?: string,
  ): Promise<UserHistoryResponse> {
    const dateFilter: { gte?: Date, lte?: Date } = {}
    if (startDate)
      dateFilter.gte = new Date(startDate)
    if (endDate)
      dateFilter.lte = new Date(endDate)

    const [calories, waters, steps] = await Promise.all([
      prisma.calorieEntry.findMany({
        where: { userId, ...(startDate || endDate ? { date: dateFilter } : {}) },
        orderBy: { date: 'desc' },
      }),
      prisma.waterEntry.findMany({
        where: { userId, ...(startDate || endDate ? { date: dateFilter } : {}) },
        orderBy: { date: 'desc' },
      }),
      prisma.stepEntry.findMany({
        where: { userId, ...(startDate || endDate ? { date: dateFilter } : {}) },
        orderBy: { date: 'desc' },
      }),
    ])

    const history: HistoryItem[] = [
      ...calories.map<CalorieHistory>(c => ({
        type: 'CALORIE',
        id: c.id,
        date: c.date,
        food: c.food,
        mealType: c.mealType,
        energyKcal: c.energyKcal,
      })),
      ...waters.map<WaterHistory>(w => ({
        type: 'WATER',
        id: w.id,
        date: w.date,
        amountMl: w.amountMl,
      })),
      ...steps.map<StepHistory>(s => ({
        type: 'STEP',
        id: s.id,
        date: s.date,
        steps: s.steps,
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return {
      userId,
      history,
    }
  }
}
