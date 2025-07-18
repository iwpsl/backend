import type { Role } from '@prisma/client'
import type { NextFunction, Response } from 'express'
import type { AuthRequest } from './auth.js'
import { err } from '../api.js'

export function roleMiddleware(requiredRole: Role) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const role = req.user?.role
    if (role !== requiredRole) {
      return res.json(err(403, 'forbidden'))
    }
    next()
  }
}
