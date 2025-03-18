import type { Role } from '@prisma/client'
import type { NextFunction, Response } from 'express'
import type { AuthRequest } from './auth'
import { err } from '../api'

export function roleMiddleware(requiredRole: Role) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const role = req.user?.role
    if (role !== requiredRole)
      return res.json(err(403, 'Forbidden'))
    next()
  }
}
