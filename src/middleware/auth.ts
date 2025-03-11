import { Request } from 'express'
import { jwtVerify, prisma } from '../utils'
import { ResponseError } from './error'
import { User } from '@prisma/client'

export interface AuthRequest extends Request {
  user?: User
}

export type AuthUser = {
  id: number
  tokenVersion: number
}

export async function expressAuthentication(req: AuthRequest, securityName: string, _scopes?: string[]) {
  if (securityName === 'auth') {
    const token = req.header('Authorization')?.split(' ')[1]
    if (!token) throw new ResponseError(401, 'Unauthorized')

    try {
      const jwtUser = jwtVerify<AuthUser>(token)
      const user = await prisma.user.findUnique({ where: { id: jwtUser.id } })

      if (!user) throw new ResponseError(401, 'Invalid credentials')
      if (jwtUser.tokenVersion !== user?.tokenVersion) throw new ResponseError(401, 'Invalid credentials')

      return user
    } catch (e) {
      throw new ResponseError(401, 'Unauthorized')
    }
  }
}
