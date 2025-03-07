import { Get, Request, Route, Security } from 'tsoa'
import { AuthRequest, AuthUser } from '../middleware/auth';
import { OkResponse } from './common';

type ProtectedResponse = OkResponse & {
  user: AuthUser
}

@Route('protected')
@Security('auth')
export class ProtectedController {
  @Get()
  public async get(@Request() req: AuthRequest): Promise<ProtectedResponse> {
    return {
      message: 'This is protected route',
      user: req.user!
    }
  }
}
