import { NextFunction, Response } from 'express'
import { AuthRequest } from './auth'
import { err } from './common'
import { Role } from '@prisma/client'

export function roleMiddleware(requiredRole: Role) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const role = req.user?.role
    if (role !== requiredRole) return err(res, 403, 'Forbidden')
    next()
  }
}
