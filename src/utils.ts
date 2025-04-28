import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'
import * as dateFns from 'date-fns'
import dotenv from 'dotenv'
import jwt from 'jsonwebtoken'
import nodemailer from 'nodemailer'

dotenv.config()
export const isDev = process.env.ENVIRONMENT === 'dev'
export const port = process.env.PORT || '3000'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export function pathFromRoot(str: string) {
  return path.join(__dirname, '..', str)
}

export const baseUrl = process.env.BASE_URL as string

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

export function getDateOnly(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

export const df = dateFns
