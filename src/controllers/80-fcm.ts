import type { Api } from '../api.js'
import type { AuthRequest } from '../middleware/auth.js'
import { Body, Controller, Middlewares, Post, Request, Route, Security, Tags } from 'tsoa'
import { ok } from '../api.js'
import { db } from '../db.js'
import { roleMiddleware } from '../middleware/role.js'
import { verifiedMiddleware } from '../middleware/verified.js'

interface FcmTokenData {
  token: string
}

@Route('fcm')
@Tags('FCM')
@Security('auth')
@Middlewares(roleMiddleware('user'), verifiedMiddleware)
export class FcmController extends Controller {
  /** Update FCM token. */
  @Post('/token')
  public async subscribeToken(
    @Request() req: AuthRequest,
    @Body() body: FcmTokenData,
  ): Api {
    const userId = req.user!.id

    await db.user.updateMany({
      where: { fcmToken: body.token },
      data: { fcmToken: null },
    })

    await db.user.update({
      where: { id: userId },
      data: { fcmToken: body.token },
    })

    return ok()
  }
}
