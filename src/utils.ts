import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import * as dateFns from 'date-fns'
import dotenv from 'dotenv'

dotenv.config()
export const isDev = process.env.ENVIRONMENT === 'dev'
export const port = process.env.PORT || '3000'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export function pathFromRoot(str: string) {
  return path.join(__dirname, '..', str)
}

export const baseUrl = process.env.BASE_URL as string

export function getDateOnly(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

export const df = dateFns
