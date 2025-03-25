import process from 'node:process'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'
import { OAuth2Client } from 'google-auth-library'
import jwt from 'jsonwebtoken'
import nodemailer from 'nodemailer'

dotenv.config()
export const isDev = process.env.ENVIRONMENT === 'dev'
export const port = process.env.PORT || '3000'

export const prisma = new PrismaClient()

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

export const mailer = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export async function sendMail(to: string, subject: string, text: string) {
  await mailer.sendMail({
    from: `${process.env.SMTP_NAME} <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
  })
}

export const GOOGLE_OAUTH_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID
export const oauth = new OAuth2Client(GOOGLE_OAUTH_CLIENT_ID)
