import { Controller, Get, Path, Query, Response, Route, Tags } from 'tsoa'
import prisma from '../prisma/client'

@Route('history')
@Tags('History')
export class HistoryController extends Controller {
  /**
   * Get user's calorie, water, and step history.
   * Optional date range filtering using `startDate` and `endDate`.
   */
  @Get('{userId}')
  @Response<null>(404, 'User not found')
  public async getUserHistory(
    @Path() userId: string,
    @Query() startDate?: string,
    @Query() endDate?: string,
  ): Promise<{
      userId: string
      calorieEntries: {
        id: number
        date: Date
        food: string
        mealType: string
        energyKcal: number
        proteinGr: number
        carbohydrateGr: number
        fatGr: number
        sugarGr: number
        sodiumMg: number
      }[]
      waterEntries: {
        id: number
        date: Date
        amountMl: number
      }[]
      stepEntries: {
        id: number
        date: Date
        steps: number
      }[]
    }> {
    const dateFilter: { gte?: Date, lte?: Date } = {}
    if (startDate)
      dateFilter.gte = new Date(startDate)
    if (endDate)
      dateFilter.lte = new Date(endDate)

    const [calorieEntries, waterEntries, stepEntries] = await Promise.all([
      prisma.calorieEntry.findMany({
        where: {
          userId,
          ...(startDate || endDate ? { date: dateFilter } : {}),
        },
        orderBy: { date: 'desc' },
      }),
      prisma.waterEntry.findMany({
        where: {
          userId,
          ...(startDate || endDate ? { date: dateFilter } : {}),
        },
        orderBy: { date: 'desc' },
      }),
      prisma.stepEntry.findMany({
        where: {
          userId,
          ...(startDate || endDate ? { date: dateFilter } : {}),
        },
        orderBy: { date: 'desc' },
      }),
    ])

    return {
      userId,
      calorieEntries,
      waterEntries,
      stepEntries,
    }
  }
}
