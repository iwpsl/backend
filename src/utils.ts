import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
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
