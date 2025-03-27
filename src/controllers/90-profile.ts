import type { Api } from '../api.js'
import type { AuthRequest } from '../middleware/auth.js'
import { Body, Controller, Get, Middlewares, Post, Request, Route, Security, Tags } from 'tsoa'
import { err, ok } from '../api.js'
import { roleMiddleware } from '../middleware/role.js'
import { verifiedMiddleware } from '../middleware/verified.js'
import { prisma } from '../utils.js'

interface ProfileData {
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
@Middlewares(roleMiddleware('USER'), verifiedMiddleware)
export class ProfileController extends Controller {
  /** Get profile for currently logged-in user. */
  @Get()
  public async getProfile(@Request() req: AuthRequest): Api<ProfileData> {
    const profile = await prisma.profile.findUnique({ where: { userId: req.user!.id } })
    if (!profile)
      return err(404, 'not-found')

    const { id, userId, updatedAt, createdAt, ...rest } = profile
    return ok(rest)
  }

  /** Create or update the profile for currently logged-in user. */
  @Post()
  public async postProfile(
    @Request() req: AuthRequest,
    @Body() body: ProfileData,
  ): Api {
    const id = req.user!.id
    await prisma.profile.upsert({
      where: { userId: id },
      create: { userId: id, ...body },
      update: body,
    })

    return ok()
  }
}
