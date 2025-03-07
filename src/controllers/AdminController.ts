import { Profile, User } from '@prisma/client'
import { Controller, Get, Middlewares, Route, Security, Tags } from 'tsoa'
import { roleMiddleware } from '../middleware/role'
import { prisma } from '../utils'

type ProfileResponse = Array<User & {
  profile: Profile | null
}>

@Route('admin')
@Tags('Admin')
@Security('auth')
@Middlewares(roleMiddleware('ADMIN'))
export class AdminController extends Controller {
  /** Get list of profiles. */
  @Get('/profiles')
  public async getProfiles(): Promise<ProfileResponse> {
    const r = await prisma.user.findMany({ include: { Profile: true } })
    return r.map(({ Profile, ...user }) => ({ profile: Profile, ...user }))
  }
}
