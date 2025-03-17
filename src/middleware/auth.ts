import { NextFunction, Request, Response } from 'express'
import { jwtVerify, prisma } from '../utils'
import { User } from '@prisma/client'
import { err } from '../api'

export interface AuthRequest extends Request {
  user?: User
}

export type AuthUser = {
  id: number
  tokenVersion: number
}

class AuthError extends Error {}

export async function expressAuthentication(req: AuthRequest, securityName: string, _scopes?: string[]) {
  if (securityName === 'auth') {
    const token = req.header('Authorization')?.split(' ')[1]
    console.log('1')
    if (!token) throw new AuthError()

    try {
      const jwtUser = jwtVerify<AuthUser>(token)
      const user = await prisma.user.findUnique({ where: { id: jwtUser.id } })

      console.log('2')
      if (!user) throw new AuthError()
      console.log('3')
      if (jwtUser.tokenVersion !== user.tokenVersion) throw new AuthError()

      return user
    } catch (e) {
      console.log('4')
      console.log(e)
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
