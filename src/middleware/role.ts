import { NextFunction, Response } from 'express'
import { AuthRequest } from './auth'
import { Role } from '@prisma/client'
import { err } from '../api'

export function roleMiddleware(requiredRole: Role) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const role = req.user?.role
    if (role !== requiredRole) return res.json(err(403, 'Forbidden'))
    next()
  }
}
