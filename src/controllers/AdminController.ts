import { Profile, User } from '@prisma/client'
import { Controller, Get, Middlewares, Route, Security, Tags } from 'tsoa'
import { roleMiddleware } from '../middleware/role'
import { prisma } from '../utils'

type PublicProfile = Pick<Profile, 'name' | 'dateOfBirth' | 'gender' | 'heightCm' | 'weightKg' | 'bloodType'>
type PublicUser = Pick<User, 'email'>
type ProfileResponse = Array<PublicUser & PublicProfile>

@Route('admin')
@Tags('Admin')
@Security('auth')
@Middlewares(roleMiddleware('ADMIN'))
export class AdminController extends Controller {
  /** Get list of profiles. */
  @Get('/profiles')
  public async getProfiles(): Promise<ProfileResponse> {
    const r = await prisma.user.findMany({
      where: {
        role: { not: 'ADMIN' },
        Profile: { isNot: null }
      },
      select: {
        email: true,
        Profile: {
          select: {
            name: true,
            dateOfBirth: true,
            gender: true,
            heightCm: true,
            weightKg: true,
            bloodType: true,
          }
        }
      }
    })

    return r.map(({ Profile, ...user }) => ({ ...user, ...Profile! }))
  }
}
