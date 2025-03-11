import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import nodemailer from 'nodemailer'

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

export const mailer = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
})

export async function sendMail(to: string, subject: string, text: string) {
  await mailer.sendMail({
    from: `${process.env.SMTP_NAME} <${process.env.SMTP_USER}>`,
    to, subject, text
  })
}
