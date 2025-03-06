import { NextFunction, Request, Response } from 'express'
import { jwtVerify } from '../utils'

export interface AuthRequest extends Request {
  user?: AuthUser
}

export type AuthUser = {
  userId: number
  email: string
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.header('Authorization')?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const verified = jwtVerify<AuthUser>(token)
    req.user = verified
    next()
  } catch (e) {
    res.status(400).json({ error: 'Invalid token' })
  }
}
