import type { ActivityLevel, FastingCategory, Gender, MainGoal } from '@prisma/client'
import type { Api } from '../api.js'
import type { CalorieData, CalorieDataWithPercentage } from './70-calorie.js'
import type { FastingCommonCategory } from './70-fasting.js'
import type { StepSumData } from './70-step.js'
import type { WaterData } from './70-water.js'
import { Body, Controller, Get, Middlewares, Path, Post, Route, Security, Tags } from 'tsoa'
import { ok } from '../api.js'
import { db } from '../db.js'
import { fcm } from '../firebase/firebase.js'
import { roleMiddleware } from '../middleware/role.js'
import { df, getDateOnly, reduceAvg } from '../utils.js'
import { avgCalorie, sumCalorie } from './70-calorie.js'

type AdminProfileData = Array<{
  email: string
  name: string
  mainGoal: MainGoal
  age: number
  gender: Gender
  heightCm: number
  weightKg: number
  weightTargetKg: number
  activityLevel: ActivityLevel
}>

interface NotificationData {
  token: string
  title: string
  body: string | null
  imageUrl: string | null
}

interface CalorieRecapData {
  average: CalorieDataWithPercentage
}

interface StepRecapData {
  average: StepSumData
}

interface WaterRecapData {
  average: WaterData
}

async function getDailyAvg(dateOnly: Date) {
  const headers = await db.calorieHeader.findMany({
    where: {
      date: dateOnly,
    },
    include: {
      entries: true,
    },
  })

  const sum: CalorieData[] = headers.map(it => sumCalorie(it.entries))
  return avgCalorie(sum)
}

@Route('admin')
@Tags('Admin')
@Security('auth')
@Middlewares(roleMiddleware('admin'))
export class AdminController extends Controller {
  /** Get list of profiles. */
  @Get('/profiles')
  public async getProfiles(): Api<AdminProfileData> {
    const r = await db.user.findMany({
      where: {
        role: { not: 'admin' },
        profile: { isNot: null },
      },
      select: {
        email: true,
        profile: {
          select: {
            name: true,
            mainGoal: true,
            age: true,
            gender: true,
            heightCm: true,
            weightKg: true,
            weightTargetKg: true,
            activityLevel: true,
          },
        },
      },
    })

    return ok(r.map(({ profile, ...user }) => ({ ...user, ...profile! })))
  }

  /** Send a notification to a specified device token. */
  @Post('/notification')
  public async sendNotification(@Body() body: NotificationData): Api {
    await fcm.send({
      token: body.token,
      notification: {
        title: body.title,
        body: body.body ?? undefined,
        imageUrl: body.imageUrl ?? undefined,
      },
    })
    return ok()
  }

  @Get('/recap/calorie/daily/{date}')
  public async getGlobalDailyCalorieRecap(
    @Path() date: Date,
  ): Api<CalorieRecapData> {
    const dateOnly = getDateOnly(date)
    return ok({
      average: await getDailyAvg(dateOnly),
    })
  }

  @Get('/recap/calorie/weekly/{startDate}')
  public async getGlobalWeeklyCalorieRecap(
    @Path() startDate: Date,
  ): Api<CalorieRecapData> {
    const startDateOnly = getDateOnly(startDate)
    const allDateOnly = Array.from({ length: 7 }, (_v, i) => df.addDays(startDateOnly, i))
    const averages = await Promise.all(allDateOnly.map(it => getDailyAvg(it)))
    return ok({
      average: avgCalorie(averages),
    })
  }

  @Get('/recap/fasting/daily/{date}')
  public async getGlobalDailyFastingRecap(
    @Path() date: Date,
  ): Api<FastingCommonCategory> {
    const dateOnly = getDateOnly(date)

    const res = await db.fastingEntry.findMany({
      where: {
        startTime: {
          gte: dateOnly,
          lt: df.addDays(dateOnly, 1),
        },
        finishedAt: {
          gte: db.fastingEntry.fields.endTime,
        },
      },
    })

    const categoryCount: Partial<Record<FastingCategory, number>> = {}
    for (const item of res) {
      categoryCount[item.category] = (categoryCount[item.category] ?? 0) + 1
    }

    const commonCategory = Object.entries(categoryCount).reduce(
      (max, [category, count]) => count > max.count ? { category: category as FastingCategory, count } : max,
      { category: undefined as FastingCategory | undefined, count: -Infinity },
    )

    return ok({
      commonCategory: commonCategory.category,
    })
  }

  @Get('/recap/fasting/weekly/{startDate}')
  public async getGlobalWeeklyFastingRecap(
    @Path() startDate: Date,
  ): Api<FastingCommonCategory> {
    const startDateOnly = getDateOnly(startDate)
    const endDateOnly = df.addDays(startDate, 7)

    const res = await db.fastingEntry.findMany({
      where: {
        startTime: {
          gte: startDateOnly,
          lt: endDateOnly,
        },
        finishedAt: {
          gte: db.fastingEntry.fields.endTime,
        },
      },
      orderBy: {
        startTime: 'asc',
      },
    })

    const categoryCount: Partial<Record<FastingCategory, number>> = {}
    for (const item of res) {
      categoryCount[item.category] = (categoryCount[item.category] ?? 0) + 1
    }

    const commonCategory = Object.entries(categoryCount).reduce(
      (max, [category, count]) => count > max.count ? { category: category as FastingCategory, count } : max,
      { category: undefined as FastingCategory | undefined, count: -Infinity },
    )

    return ok({
      commonCategory: commonCategory.category,
    })
  }

  @Get('/recap/step/daily/{date}')
  public async getGlobalDailyStepRecap(
    @Path() date: Date,
  ): Api<StepRecapData> {
    const dateOnly = getDateOnly(date)
    const res = await db.stepEntry.findMany({
      where: {
        date: dateOnly,
      },
    })

    return ok({
      average: {
        steps: reduceAvg(res, it => it.steps),
        distanceKm: reduceAvg(res, it => it.distanceKm),
        activeMinutes: reduceAvg(res, it => it.activeMinutes),
      },
    })
  }

  @Get('/recap/step/weekly/{startDate}')
  public async getGlobalWeeklyStepRecap(
    @Path() startDate: Date,
  ): Api<StepRecapData> {
    const startDateOnly = getDateOnly(startDate)
    const endDateOnly = df.addDays(startDate, 7)

    const res = await db.stepEntry.findMany({
      where: {
        date: {
          gte: startDateOnly,
          lt: endDateOnly,
        },
      },
    })

    return ok({
      average: {
        steps: reduceAvg(res, it => it.steps),
        distanceKm: reduceAvg(res, it => it.distanceKm),
        activeMinutes: reduceAvg(res, it => it.activeMinutes),
      },
    })
  }

  @Get('/recap/water/daily/{date}')
  public async getGlobalDailyWaterRecap(
    @Path() date: Date,
  ): Api<WaterRecapData> {
    const dateOnly = getDateOnly(date)
    const res = await db.waterEntry.findMany({
      where: {
        date: dateOnly,
      },
    })

    return ok({
      average: {
        amountMl: reduceAvg(res, it => it.amountMl),
      },
    })
  }

  @Get('/recap/water/weekly/{startDate}')
  public async getGlobalWeeklyWaterRecap(
    @Path() startDate: Date,
  ): Api<WaterRecapData> {
    const startDateOnly = getDateOnly(startDate)
    const endDateOnly = df.addDays(startDateOnly, 7)

    const res = await db.waterEntry.findMany({
      where: {
        date: {
          gte: startDateOnly,
          lt: endDateOnly,
        },
      },
    })

    return ok({
      average: {
        amountMl: reduceAvg(res, it => it.amountMl),
      },
    })
  }
}
