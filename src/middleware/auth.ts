import { Request } from 'express'
import { jwtVerify } from '../utils'
import { Role } from '@prisma/client'
import { ResponseError } from './error'

export interface AuthRequest extends Request {
  user?: AuthUser
}

export type AuthUser = {
  userId: number
  email: string
  role: Role
}

export async function expressAuthentication(req: AuthRequest, securityName: string, _scopes?: string[]) {
  if (securityName === 'auth') {
    const token = req.header('Authorization')?.split(' ')[1]
    if (!token) throw new ResponseError(401, 'Unauthorized')

    try {
      return jwtVerify<AuthUser>(token)
    } catch (e) {
      throw new ResponseError(401, 'Unauthorized')
    }
  }
}
