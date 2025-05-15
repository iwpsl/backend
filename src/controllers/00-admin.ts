import type { ActivityLevel, Gender, MainGoal } from '@prisma/client'
import type { Api } from '../api.js'
import { Body, Controller, Get, Middlewares, Post, Route, Security, Tags } from 'tsoa'
import { ok } from '../api.js'
import { db } from '../db.js'
import { fcm } from '../firebase/firebase.js'
import { roleMiddleware } from '../middleware/role.js'

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
}
