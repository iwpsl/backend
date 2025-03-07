import { Profile } from '@prisma/client'
import { Route, Controller, Tags, Security, Post, Body, Get, Middlewares, Request, Patch } from 'tsoa'
import { OkResponse } from './common'
import { roleMiddleware } from '../middleware/role'
import { prisma } from '../utils'
import { AuthRequest } from '../middleware/auth'
import { ResponseError } from '../middleware/error'

type ProfileBody = Omit<Profile, 'id' | 'userId' | 'createdAt' | 'updatedAt'>

@Route('profile')
@Tags('Profile')
@Security('auth')
@Middlewares(roleMiddleware('USER'))
export class ProfileController extends Controller {
  /** Get profile for currently logged-in user. */
  @Get()
  public async getProfile(@Request() req: AuthRequest): Promise<ProfileBody> {
    const profile = await prisma.profile.findUnique({ where: { userId: req.user!.userId } })
    if (!profile) throw new ResponseError(404, 'Profile not found')

    const { id, userId, updatedAt, createdAt, ...rest } = profile
    return rest
  }

  /** Create or update the profile for currently logged-in user. */
  @Post()
  public async postProfile(
    @Request() req: AuthRequest,
    @Body() body: ProfileBody
  ): Promise<OkResponse> {
    const id = req.user!.userId
    await prisma.profile.upsert({
      where: { userId: id },
      create: { userId: id, ...body, },
      update: body
    })

    return { message: 'Success' }
  }
}
