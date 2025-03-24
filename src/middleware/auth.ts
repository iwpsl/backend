import type { User } from '@prisma/client'
import type { NextFunction, Request, Response } from 'express'
import { err } from '../api'
import { jwtVerify, prisma } from '../utils'

export interface AuthRequest extends Request {
  user?: User
}

export interface AuthUser {
  id: number
  tokenVersion: number
}

class AuthError extends Error {}

export async function expressAuthentication(req: AuthRequest, securityName: string, _scopes?: string[]) {
  if (securityName === 'auth') {
    const token = req.header('Authorization')?.split(' ')[1]
    if (!token)
      throw new AuthError()

    try {
      const jwtUser = jwtVerify<AuthUser>(token)
      if (!jwtUser)
        throw new AuthError()

      const user = await prisma.user.findUnique({ where: { id: jwtUser.id } })
      if (!user)
        throw new AuthError()
      if (jwtUser.tokenVersion !== user.tokenVersion)
        throw new AuthError()

      return user
    } catch {
      throw new AuthError()
    }
  }
}

export function authErrorMiddleware(e: any, _req: Request, res: Response, next: NextFunction): void {
  if (e instanceof AuthError) {
    res.json(err(401, 'Unauthorized'))
  } else {
    next()
  }
}
