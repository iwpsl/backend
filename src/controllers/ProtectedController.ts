import { Get, Middlewares, Request, Route, Security } from 'tsoa'
import { authMiddleware, AuthRequest, AuthUser } from '../middleware/auth';
import { MaybePromise, OkResponse } from './common';

type ProtectedResponse = OkResponse & {
  user: AuthUser
}

@Route('protected')
@Middlewares(authMiddleware)
export class ProtectedController {
  @Get()
  public async get(@Request() req: AuthRequest): MaybePromise<ProtectedResponse> {
    return {
      message: 'This is protected route',
      user: req.user!
    }
  }
}
