import { Body, Controller, Get, Middlewares, Post, Request, Route, Security, Tags } from 'tsoa'
import { AuthRequest } from '../middleware/auth'
import { ResponseError } from '../middleware/error'
import { roleMiddleware } from '../middleware/role'
import { prisma } from '../utils'
import { OkResponse } from './common'

type ProfileBody = {
    name: string
    dateOfBirth: Date
    gender: string
    heightCm: number
    weightKg: number
    bloodType: string
}

@Route('profile')
@Tags('Profile')
@Security('auth')
@Middlewares(roleMiddleware('USER'))
export class ProfileController extends Controller {
  /** Get profile for currently logged-in user. */
  @Get()
  public async getProfile(@Request() req: AuthRequest): Promise<ProfileBody> {
    const profile = await prisma.profile.findUnique({ where: { userId: req.user!.id } })
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
    const id = req.user!.id
    await prisma.profile.upsert({
      where: { userId: id },
      create: { userId: id, ...body, },
      update: body
    })

    return { message: 'Success' }
  }
}
