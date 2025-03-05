import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { Response } from 'express'
import jwt from 'jsonwebtoken'

export const prisma = new PrismaClient()

export function jwtSign<T extends Record<string, unknown>>(payload: T, option?: jwt.SignOptions) {
  return jwt.sign(payload, process.env.JWT_SECRET as string, option)
}

export function jwtVerify<T extends Record<string, unknown>>(token: string) {
  return jwt.verify(token, process.env.JWT_SECRET as string) as T
}

export function bcryptHash(input: string) {
  return bcrypt.hash(input, process.env.BCRYPT_SALT as string)
}

export function error(res: Response, status: number, error: string) {
  res.status(status).json({ error })
}

export function ok(res: Response, message: string, extra?: Record<string, any>) {
  res.json({ message, ...extra })
}
