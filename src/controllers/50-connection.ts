import type { Api, UUID } from '../api.js'
import type { AuthRequest } from '../middleware/auth.js'
import { Controller, Get, Middlewares, Path, Post, Query, Request, Route, Security, Tags } from 'tsoa'
import { err, ok } from '../api.js'
import { db } from '../db.js'
import { fcm } from '../firebase/firebase.js'
import { roleMiddleware } from '../middleware/role.js'
import { verifiedMiddleware } from '../middleware/verified.js'
import { baseUrl } from '../utils.js'

interface FriendData {
  userId: UUID
  name: string
  avatarUrl: string
}

@Route('connection')
@Tags('Connection')
@Security('auth')
@Middlewares(roleMiddleware('user'), verifiedMiddleware)
export class ConnectionController extends Controller {
  /** Get other people's profile. */
  @Get('/profile/{userId}')
  public async getOtherProfile(
    @Path() userId: UUID,
  ): Api<FriendData> {
    const res = await db.user.findUnique({
      where: { id: userId, profile: { isNot: null } },
      include: { profile: true },
    })

    if (!res || !res.profile) {
      return err(404, 'not-found')
    }

    return ok({
      userId: res.id,
      name: res.profile.name,
      avatarUrl: `${baseUrl}/avatars/${res.id}.jpg`,
    })
  }

  /** Get all friends. */
  @Get('/all')
  public async getAllFriends(
    @Request() req: AuthRequest,
  ): Api<FriendData[]> {
    const userId = req.user!.id

    const res = await db.userConnection.findMany({
      where: { OR: [
        { aId: userId },
        { bId: userId },
      ] },
      include: {
        a: { include: { profile: true } },
        b: { include: { profile: true } },
      },
    })

    return ok(res.map((it) => {
      const friend = it.a.id === userId ? it.b : it.a
      return {
        userId: friend.id,
        name: friend.profile!.name,
        avatarUrl: `${baseUrl}/avatars/${friend.id}.jpg`,
      }
    }))
  }

  /** Get all received friend requests. */
  @Get('/received')
  public async getReceivedFriendRequests(
    @Request() req: AuthRequest,
  ): Api<FriendData[]> {
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
      orderBy: {
        createdAt: 'desc',
      },
    })

    return ok(res.map(it => ({
      userId: it.from.id,
      name: it.from.profile!.name,
      avatarUrl: `${baseUrl}/avatars/${it.from.id}.jpg`,
    })))
  }

  /** Get all sent friend requests. */
  @Get('/sent')
  public async getSentFriendRequests(
    @Request() req: AuthRequest,
  ): Api<FriendData[]> {
    const userId = req.user!.id

    const res = await db.connectionRequest.findMany({
      where: {
        fromId: userId,
        from: { profile: { isNot: null } },
      },
      include: {
        to: {
          include: { profile: true },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return ok(res.map(it => ({
      userId: it.to.id,
      name: it.to.profile!.name,
      avatarUrl: `${baseUrl}/avatars/${it.to.id}.jpg`,
    })))
  }

  /** Send a friend request. */
  @Post('/send/{targetUserId}')
  public async sendFriendRequest(
    @Request() req: AuthRequest,
    @Path() targetUserId: UUID,
  ): Api<FriendData> {
    const userId = req.user!.id
    if (userId === targetUserId) {
      return err(403, 'forbidden')
    }

    const targetUser = await db.user.findUnique({
      where: {
        id: targetUserId,
        profile: { isNot: null },
      },
      include: { profile: true },
    })
    if (!targetUser) {
      return err(404, 'not-found')
    }

    const requested = await db.connectionRequest.findUnique({
      where: { fromId_toId: { fromId: userId, toId: targetUserId } },
    })
    if (requested) {
      return err(403, 'connection-already-requested')
    }

    const theyRequested = await db.connectionRequest.findUnique({
      where: { fromId_toId: { fromId: targetUserId, toId: userId } },
    })
    if (theyRequested) {
      return err(403, 'connection-they-requested')
    }

    await db.connectionRequest.create({
      data: { fromId: userId, toId: targetUserId },
    })

    if (targetUser.fcmToken) {
      await fcm.send({
        token: targetUser.fcmToken,
        notification: {
          title: 'Friend Request',
          body: `${targetUser.profile!.name} requested you to be your friend!`,
        },
      })
    }

    return ok({
      userId: targetUser.id,
      name: targetUser.profile!.name,
      avatarUrl: `${baseUrl}/avatars/${targetUser.id}.jpg`,
    })
  }

  /** Accept (or deny) a friend request. */
  @Post('/accept/{fromUserId}')
  public async acceptFriendRequest(
    @Request() req: AuthRequest,
    @Path() fromUserId: UUID,
    @Query() accept: boolean,
  ): Api<FriendData> {
    const userId = req.user!.id

    const res = await db.connectionRequest.findUnique({
      where: { fromId_toId: { fromId: fromUserId, toId: userId } },
      include: { from: { include: { profile: true } } },
    })

    if (!res) {
      return err(404, 'not-found')
    }

    if (res.toId !== userId) {
      return err(403, 'connection-not-for-you')
    }

    await db.$transaction(async (tx) => {
      if (accept) {
        const [aId, bId] = [res.fromId, res.toId].sort()

        await tx.userConnection.upsert({
          where: { aId_bId: { aId, bId } },
          create: { aId, bId },
          update: {},
        })
      }

      await tx.connectionRequest.delete({
        where: { fromId_toId: { fromId: fromUserId, toId: userId } },
      })
    })

    return ok({
      userId: res.from.id,
      name: res.from.profile!.name,
      avatarUrl: `${baseUrl}/avatars/${res.from.id}.jpg`,
    })
  }

  /** Remove a friend. */
  @Post('/unfriend/{friendUserId}')
  public async unfriend(
    @Request() req: AuthRequest,
    @Path() friendUserId: UUID,
  ): Api<FriendData> {
    const userId = req.user!.id
    const [aId, bId] = [userId, friendUserId].sort()

    try {
      await db.userConnection.delete({
        where: { aId_bId: { aId, bId } },
      })

      const profile = await db.profile.findUnique({
        where: { userId: friendUserId },
      })

      return ok({
        userId: profile!.userId,
        name: profile!.name,
        avatarUrl: `${baseUrl}/avatars/${profile!.userId}.jpg`,
      })
    } catch {
      return err(404, 'not-found')
    }
  }
}
