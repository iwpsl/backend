import type { ActivityLevel, Gender, MainGoal, Profile } from '@prisma/client'
import type { Api, ApiRes } from '../api.js'
import type { AuthRequest } from '../middleware/auth.js'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { Body, Controller, Delete, Get, Middlewares, Post, Request, Route, Security, Tags, UploadedFile } from 'tsoa'
import { err, ok } from '../api.js'
import { db } from '../db.js'
import { roleMiddleware } from '../middleware/role.js'
import { verifiedMiddleware } from '../middleware/verified.js'
import { baseUrl, pathFromRoot } from '../utils.js'

export interface ProfileData {
  name: string
  mainGoal: MainGoal
  age: number
  gender: Gender
  heightCm: number
  weightKg: number
  weightTargetKg: number
  activityLevel: ActivityLevel
}

export interface ProfileDataResult extends ProfileData {
  userId: string
  avatarUrl: string
}

export function getAvatarUrl({ avatarId }: Pick<Profile, 'avatarId'>) {
  return `${baseUrl}/avatars/${avatarId}.jpg`
}

export async function uploadAvatar<T = {}>(
  userId: string,
  file: Express.Multer.File,
): Promise<[ApiRes<T>, Profile?]> {
  if (!file.mimetype.startsWith('image/')) {
    return [err(400, 'invalid-file-type'), undefined]
  }

  if (file.size > 5_000_000) {
    return [err(413, 'file-too-large'), undefined]
  }

  const profile = await db.profile.findUnique({
    where: { userId },
  })

  if (!profile) {
    return [err(404, 'not-found'), undefined]
  }

  if (profile.avatarId) {
    const fsPath = pathFromRoot(`public/avatars/${profile.avatarId}.jpg`)
    await fs.rm(fsPath, { force: true })
  }

  const avatarId = randomUUID()
  const fsPath = pathFromRoot(`public/avatars/${avatarId}.jpg`)
  await fs.mkdir(path.dirname(fsPath), { recursive: true })

  await sharp(file.buffer)
    .resize(300, 300)
    .jpeg({ quality: 80 })
    .toFile(fsPath)

  const res = await db.profile.update({
    where: { userId },
    data: { avatarId },
  })

  return [ok(), res]
}

export async function deleteAvatar(userId: string): Api {
  const profile = await db.profile.findUnique({
    where: { userId },
  })

  if (!profile || !profile.avatarId) {
    return err(404, 'not-found')
  }

  const fsPath = pathFromRoot(`public/avatars/${profile.avatarId}.jpg`)
  await fs.rm(fsPath, { force: true })
  return ok()
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

    const { id, avatarId, updatedAt, createdAt, ...rest } = profile
    return ok({
      ...rest,
      avatarUrl: getAvatarUrl(profile),
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
    const [res, _] = await uploadAvatar(req.user!.id, file)
    return res
  }

  @Delete('/avatar')
  public async deleteAvatar(
    @Request() req: AuthRequest,
  ): Api {
    return await deleteAvatar(req.user!.id)
  }
}
