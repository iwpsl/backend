import type { ActivityLevel, Gender, MainGoal } from '@prisma/client'
import type { Api } from '../api.js'
import type { AuthRequest } from '../middleware/auth.js'
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { Body, Controller, Delete, Get, Middlewares, Post, Request, Route, Security, Tags, UploadedFile } from 'tsoa'
import { err, ok } from '../api.js'
import { db } from '../db.js'
import { roleMiddleware } from '../middleware/role.js'
import { verifiedMiddleware } from '../middleware/verified.js'
import { baseUrl, pathFromRoot } from '../utils.js'

interface ProfileData {
  name: string
  mainGoal: MainGoal
  age: number
  gender: Gender
  heightCm: number
  weightKg: number
  weightTargetKg: number
  activityLevel: ActivityLevel
}

interface ProfileDataResult extends ProfileData {
  userId: string
  avatarUrl: string
}

@Route('profile')
@Tags('Profile')
@Security('auth')
@Middlewares(roleMiddleware('user'), verifiedMiddleware)
export class ProfileController extends Controller {
  /** Get profile for currently logged-in user. */
  @Get()
  public async getProfile(@Request() req: AuthRequest): Api<ProfileDataResult> {
    const profile = await db.profile.findUnique({ where: { userId: req.user!.id } })
    if (!profile) {
      return err(404, 'not-found')
    }

    const { id, updatedAt, createdAt, ...rest } = profile
    return ok({
      avatarUrl: `${baseUrl}/avatars/${profile.userId}.jpg`,
      ...rest,
    })
  }

  /** Create or update the profile for currently logged-in user. */
  @Post()
  public async postProfile(
    @Request() req: AuthRequest,
    @Body() body: ProfileData,
  ): Api {
    const id = req.user!.id
    await db.profile.upsert({
      where: { userId: id },
      create: { userId: id, ...body },
      update: body,
    })

    return ok()
  }

  @Post('/avatar')
  public async uploadAvatar(
    @Request() req: AuthRequest,
    @UploadedFile() file: Express.Multer.File,
  ): Api {
    const imgPath = pathFromRoot(`public/avatars/${req.user!.id}.jpg`)
    await fs.mkdir(path.dirname(imgPath), { recursive: true })

    await sharp(file.buffer)
      .resize(300, 300)
      .jpeg({ quality: 80 })
      .toFile(imgPath)

    return ok()
  }

  @Delete('/avatar')
  public async deleteAvatar(
    @Request() req: AuthRequest,
  ): Api {
    const imgPath = pathFromRoot(`public/avatars/${req.user!.id}.jpg`)
    await fs.rm(imgPath, { force: true })
    return ok()
  }
}
