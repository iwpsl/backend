import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

export function jwtSign<T extends Record<string, any>>(payload: T, option?: jwt.SignOptions) {
  return jwt.sign(payload, process.env.JWT_SECRET as string, option)
}

export function jwtVerify<T extends Record<string, any>>(token: string) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET as string) as T
  } catch {
    return undefined
  }
}

export function bcryptHash(input: string) {
  return bcrypt.hash(input, process.env.BCRYPT_SALT as string)
}

export const bcryptCompare = bcrypt.compare
