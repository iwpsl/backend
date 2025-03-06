import { NextFunction, Request, Response } from 'express'
import { jwtVerify } from '../utils'
import { err } from './common'
import { Role } from '@prisma/client'

export interface AuthRequest extends Request {
  user?: AuthUser
}

export type AuthUser = {
  userId: number
  email: string
  role: Role
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.header('Authorization')?.split(' ')[1]
  if (!token) return err(res, 401, 'Unauthorized')

  try {
    const verified = jwtVerify<AuthUser>(token)
    req.user = verified
    next()
  } catch (e) {
    err(res, 401, 'Unauthorized')
  }
}
