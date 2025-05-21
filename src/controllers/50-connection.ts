import type { Api, UUID } from '../api.js'
import type { AuthRequest } from '../middleware/auth.js'
import { Controller, Get, Middlewares, Path, Post, Query, Request, Route, Security, Tags } from 'tsoa'
import { err, ok } from '../api.js'
import { db } from '../db.js'
import { roleMiddleware } from '../middleware/role.js'
import { verifiedMiddleware } from '../middleware/verified.js'
import { baseUrl } from '../utils.js'

interface FriendRequestData {
  userId: UUID
  name: string
  avatarUrl: string
}

enum FriendRequestAction {
  accept,
  deny,
}

@Route('connection')
@Tags('Connection')
@Security('auth')
@Middlewares(roleMiddleware('user'), verifiedMiddleware)
export class ConnectionController extends Controller {
  @Get('/request')
  public async getFriendRequests(
    @Request() req: AuthRequest,
  ): Api<FriendRequestData[]> {
    const userId = req.user!.id

    const res = await db.connectionRequest.findMany({
      where: {
        toId: userId,
        to: { profile: { isNot: null } },
      },
      include: {
        from: {
          include: { profile: true },
        },
      },
    })

    return ok(res.map(it => ({
      userId: it.from.id,
      name: it.from.profile!.name,
      avatarUrl: `${baseUrl}/avatars/${it.from.id}.jpg`,
    })))
  }

  @Post('/request/{requestId}')
  public async friendRequestAction(
    @Request() req: AuthRequest,
    @Path() requestId: UUID,
    @Query() action: FriendRequestAction,
  ): Api {
    const userId = req.user!.id

    const res = await db.connectionRequest.findUnique({
      where: { id: requestId },
    })

    if (!res) {
      return err(404, 'not-found')
    }

    if (res.toId !== userId) {
      return err(403, 'forbidden')
    }

    await db.$transaction(async (tx) => {
      if (action === FriendRequestAction.accept) {
        const [aId, bId] = [res.fromId, res.toId].sort()

        await tx.userConnection.upsert({
          where: { aId_bId: { aId, bId } },
          create: { aId, bId },
          update: {},
        })
      }

      await tx.connectionRequest.delete({
        where: { id: requestId },
      })
    })

    return ok()
  }
}
