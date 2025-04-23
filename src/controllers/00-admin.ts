import type { Api } from '../api.js'
import { Controller, Get, Middlewares, Route, Security, Tags } from 'tsoa'
import { ok } from '../api.js'
import { db } from '../db.js'
import { roleMiddleware } from '../middleware/role.js'

type AdminProfileData = Array<{
  email: string
  name: string
  dateOfBirth: Date
  gender: string
  heightCm: number
  weightKg: number
}>

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
            dateOfBirth: true,
            gender: true,
            heightCm: true,
            weightKg: true,
          },
        },
      },
    })

    return ok(r.map(({ profile, ...user }) => ({ ...user, ...profile! })))
  }
}
