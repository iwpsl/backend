import { Profile, User } from '@prisma/client'
import { Controller, Get, Middlewares, Route, Tags } from 'tsoa'
import { authMiddleware } from '../middleware/auth'
import { roleMiddleware } from '../middleware/role'
import { prisma } from '../utils'
import { MaybePromise } from './common'

type ProfileResponse = Array<User & {
  profile: Profile | null
}>

@Route('admin')
@Tags('Admin')
@Middlewares(authMiddleware, roleMiddleware('ADMIN'))
export class AdminController extends Controller {
  @Get('/profiles')
  public async getProfiles(): MaybePromise<ProfileResponse> {
    try {
      const r = await prisma.user.findMany({ include: { Profile: true } })
      return r.map(({ Profile, ...user }) => ({ profile: Profile, ...user }))
    } catch (e) {
      console.log(e)
      this.setStatus(500)
      return { error: 'Internal server error' }
    }
  }
}
