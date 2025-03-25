import type { NextFunction, Response } from 'express'
import type { AuthRequest } from './auth'
import { err } from '../api'

export function verifiedMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user!.isVerified)
    return res.json(err(403, 'unverified'))

  next()
}
