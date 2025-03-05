import { NextFunction, Request, Response } from "express";
import { error, jwtVerify } from "../utils";

export interface AuthRequest extends Request {
  user?: AuthUser
}

export type AuthUser = {
  userId: number
  email: string
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.header('Authorization')?.split(' ')[1]
  if (!token) return error(res, 401, 'Access denied')

  try {
    const verified = jwtVerify<AuthUser>(token)
    req.user = verified
    next()
  } catch (e) {
    error(res, 400, 'Invalid token')
  }
}
