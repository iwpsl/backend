import type { FastingCategory, Prisma } from '@prisma/client'
import type { Api, UUID } from '../api.js'
import type { NotificationType } from '../firebase/firebase.js'
import type { ChallengeData, ChallengeResultData, ChallengeTaskData, ChallengeTaskResultData } from './50-challenge.js'
import type { CalorieData, CalorieDataWithPercentage } from './70-calorie.js'
import type { FastingCommonCategory } from './70-fasting.js'
import type { StepSumData } from './70-step.js'
import type { WaterData } from './70-water.js'
import type { ProfileData, ProfileDataResult } from './90-profile.js'
import { Body, Controller, Delete, Get, Middlewares, Path, Post, Query, Route, Security, Tags, UploadedFile } from 'tsoa'
import { err, ok } from '../api.js'
import { db } from '../db.js'
import { sendNotification } from '../firebase/firebase.js'
import { roleMiddleware } from '../middleware/role.js'
import { df, getDateOnly, reduceAvg } from '../utils.js'
import { avgCalorie, sumCalorie } from './70-calorie.js'
import { deleteAvatar, getAvatarUrl, uploadAvatar } from './90-profile.js'

interface AvatarData {
  avatarUrl: string
}

interface AdminProfileData extends ProfileDataResult {
  email: string
}

interface NotificationProfileData extends AdminProfileData {
  fcmToken: string
}

type SortOrder = 'asc' | 'desc'

type AdminProfileSortBy =
  | 'email'
  | 'name'
  | 'age'
  | 'heightCm'
  | 'weightKg'

interface UserOverviewData {
  totalUser: number
  pageIndex: number
  pageTotal: number
  entries: AdminProfileData[]
}

interface NotificationData {
  tokens: string[]
  title: string
  type: NotificationType
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

interface AdminChallengeData extends ChallengeResultData {
  subscriberCount: number
}

interface AdminChallengeDetailsData extends AdminChallengeData {
  tasks: ChallengeTaskResultData[]
}

interface AdminChallengeInputData extends ChallengeData {
  tasks: ChallengeTaskData[]
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
  @Get('/profile/all')
  public async adminGetProfiles(
    @Query() page: number = 1,
    @Query() limit: number = 20,
    @Query() sortOrder: SortOrder = 'asc',
    @Query() sortBy: AdminProfileSortBy = 'name',
    @Query() filter?: string,
  ): Api<UserOverviewData> {
    const where: Prisma.UserFindManyArgs['where'] = {
      role: { not: 'admin' },
      profile: { isNot: null },
    }

    const [totalUser, users] = await Promise.all([
      db.user.count({ where }),
      db.user.findMany({
        where: {
          ...where,
          ...(filter && {
            OR: [
              { email: { contains: filter, mode: 'insensitive' } },
              { profile: { name: { contains: filter, mode: 'insensitive' } } },
            ],
          }),
        },
        select: {
          email: true,
          profile: true,
        },
        take: limit,
        skip: (page - 1) * limit,
        orderBy: sortBy === 'email'
          ? { email: sortOrder }
          : { profile: { [sortBy]: sortOrder } },
      }),
    ])

    return ok({
      totalUser,
      pageIndex: page,
      pageTotal: Math.ceil(totalUser / limit),
      entries: users.map(({ profile, ...user }) => ({
        ...user,
        ...profile!,
        avatarUrl: getAvatarUrl(profile!),
      })),
    })
  }

  /** Update a profile data. */
  @Post('/profile/{userId}')
  public async adminUpdateProfile(
    @Path() userId: UUID,
    @Body() body: ProfileData,
  ): Api<AdminProfileData> {
    const res = await db.profile.update({
      where: { userId },
      data: body,
      include: {
        user: { select: { email: true } },
      },
    })

    return ok({
      email: res.user.email,
      ...res,
      avatarUrl: getAvatarUrl(res),
    })
  }

  /** Change a user avatar. */
  @Post('/avatar/{userId}')
  public async adminUpdateProfileAvatar(
    @Path() userId: UUID,
    @UploadedFile() file: Express.Multer.File,
  ): Api<AvatarData> {
    const user = await db.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      return err(404, 'not-found')
    }

    const [res, profile] = await uploadAvatar<AvatarData>(userId, file)
    if (!res.success) {
      return res
    }

    return ok({ avatarUrl: getAvatarUrl(profile!) })
  }

  /** Delete a user avatar */
  @Delete('/avatar/{userId}')
  public async adminDeleteProfileAvatar(
    @Path() userId: UUID,
  ): Api {
    return await deleteAvatar(userId)
  }

  /** Search for users that can receive notifications */
  @Get('/notification/targets')
  public async adminGetNotificationTargets(
    @Query() q: string,
  ): Api<NotificationProfileData[]> {
    if (q.length < 3) {
      return err(400, 'validation-error')
    }

    const users = await db.user.findMany({
      where: {
        role: { not: 'admin' },
        fcmToken: { not: null },
        profile: { isNot: null },
        OR: [
          { email: { contains: q, mode: 'insensitive' } },
          { profile: { name: { contains: q, mode: 'insensitive' } } },
        ],
      },
      select: {
        email: true,
        profile: true,
        fcmToken: true,
      },
      take: 10,
      orderBy: { profile: { name: 'asc' } },
    })

    return ok(users.map(({ profile, ...user }) => ({
      ...user,
      ...profile!,
      avatarUrl: getAvatarUrl(profile!),
      fcmToken: user.fcmToken!,
    })))
  }

  /** Send a notification to a specified device token. */
  @Post('/notification')
  public async adminSendNotification(@Body() body: NotificationData): Api {
    await sendNotification(body.tokens, body.type, {
      title: body.title,
      body: body.body ?? undefined,
      imageUrl: body.imageUrl ?? undefined,
    })

    return ok()
  }

  @Get('/recap/calorie/daily/{date}')
  public async adminGetGlobalDailyCalorieRecap(
    @Path() date: Date,
  ): Api<CalorieRecapData> {
    const dateOnly = getDateOnly(date)
    return ok({
      average: await getDailyAvg(dateOnly),
    })
  }

  @Get('/recap/calorie/weekly/{startDate}')
  public async adminGetGlobalWeeklyCalorieRecap(
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
  public async adminGetGlobalDailyFastingRecap(
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
  public async adminGetGlobalWeeklyFastingRecap(
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
  public async adminGetGlobalDailyStepRecap(
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
  public async adminGetGlobalWeeklyStepRecap(
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
  public async adminGetGlobalDailyWaterRecap(
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
  public async adminGetGlobalWeeklyWaterRecap(
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

  /** Get all challenges */
  @Get('/challenge/all')
  public async adminGetChallenges(): Api<AdminChallengeData[]> {
    const res = await db.challenge.findMany({
      where: { deletedAt: null },
      include: {
        _count: { select: {
          tasks: true,
          subs: {
            where: { finishedAt: null },
          },
        } },
      },
    })

    return ok(res.map(it => ({
      id: it.id,
      title: it.title,
      description: it.description,
      category: it.category,
      taskCount: it._count.tasks,
      subscriberCount: it._count.subs,
    })))
  }

  /** Get challenge details */
  @Get('/challenge/details/{challengeId}')
  public async adminGetChallengeDetails(
    @Path() challengeId: UUID,
  ): Api<AdminChallengeDetailsData> {
    const res = await db.challenge.findUnique({
      where: {
        id: challengeId,
        deletedAt: null,
      },
      include: {
        _count: { select: {
          subs: {
            where: { finishedAt: null },
          },
        } },
        tasks: {
          orderBy: {
            day: 'asc',
          },
        },
      },
    })

    if (!res) {
      return err(404, 'not-found')
    }

    return ok({
      id: res.id,
      title: res.title,
      description: res.description,
      category: res.category,
      subscriberCount: res._count.subs,
      taskCount: res.tasks.length,
      tasks: res.tasks.map(it => ({
        id: it.id,
        day: it.day,
        description: it.description,
      })),
    })
  }

  /** Create new challenge. */
  @Post('/challenge')
  public async adminCreateNewChallenge(
    @Body() body: AdminChallengeInputData,
  ): Api<AdminChallengeDetailsData> {
    return await db.$transaction(async (tx) => {
      const challenge = await tx.challenge.create({
        data: {
          category: body.category,
          title: body.title,
          description: body.description,
        },
      })

      await tx.challengeTask.createMany({
        data: body.tasks.map(it => ({
          challengeId: challenge.id,
          ...it,
        })),
      })

      return this.adminGetChallengeDetails(challenge.id)
    })
  }

  /** Delete a challenge */
  @Delete('/challenge/delete/{challengeId}')
  public async adminDeleteChallenge(
    @Path() challengeId: UUID,
  ): Api {
    return await db.$transaction(async (tx) => {
      await tx.challenge.update({
        where: { id: challengeId, deletedAt: null },
        data: { deletedAt: new Date() },
      })

      await tx.challengeSubscription.updateMany({
        where: { challengeId },
        data: { finishedAt: new Date() },
      })

      return ok()
    })
  }
}
