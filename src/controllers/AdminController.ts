import type { Api } from '../api'
import { Controller, Get, Middlewares, Route, Security, Tags } from 'tsoa'
import { ok } from '../api'
import { roleMiddleware } from '../middleware/role'
import { prisma } from '../utils'

type AdminProfileData = Array<{
  email: string
  name: string
  dateOfBirth: Date
  gender: string
  heightCm: number
  weightKg: number
  bloodType: string
}>

@Route('admin')
@Tags('Admin')
@Security('auth')
@Middlewares(roleMiddleware('ADMIN'))
export class AdminController extends Controller {
  /** Get list of profiles. */
  @Get('/profiles')
  public async getProfiles(): Api<AdminProfileData> {
    const r = await prisma.user.findMany({
      where: {
        role: { not: 'ADMIN' },
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
            bloodType: true,
          },
        },
      },
    })

    return ok(r.map(({ profile, ...user }) => ({ ...user, ...profile! })))
  }
}
