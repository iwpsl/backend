import type { Api, UUID } from '../api.js'
import type { AuthRequest } from '../middleware/auth.js'
import { Controller, Get, Middlewares, Request, Route, Security, Tags } from 'tsoa'
import { ok } from '../api.js'
import { db } from '../db.js'
import { roleMiddleware } from '../middleware/role.js'
import { verifiedMiddleware } from '../middleware/verified.js'

interface ExperienceData {
  level: number
  xp: number
  requiredXp: number
}

async function getOrCreateXp(userId: UUID) {
  return await db.experience.upsert({
    where: { userId },
    create: { userId, xp: 0, level: 0 },
    update: {},
  })
}

function getRequiredXp(level: number) {
  const baseXp = 50
  const growth = 5
  return baseXp + (level ** 2 * growth)
}

export async function addXp(userId: UUID, xpToAdd: number) {
  const lastXp = await getOrCreateXp(userId)

  let xp = lastXp.xp + xpToAdd
  let level = lastXp.level
  let requiredXp = getRequiredXp(level)

  while (xp >= requiredXp) {
    xp -= requiredXp
    level++
    requiredXp = getRequiredXp(level)
  }

  await db.experience.update({
    where: { userId },
    data: { xp, level },
  })
}

@Route('xp')
@Tags('Experience')
@Security('auth')
@Middlewares(roleMiddleware('user'), verifiedMiddleware)
export class ExperienceController extends Controller {
  @Get()
  public async getXp(
    @Request() req: AuthRequest,
  ): Api<ExperienceData> {
    const userId = req.user!.id
    const res = await getOrCreateXp(userId)

    return ok({
      ...res,
      requiredXp: getRequiredXp(res.level),
    })
  }
}
