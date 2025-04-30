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

export type ToNumber<T> = (t: T) => number

export function reduceSum<T>(arr: T[], fn: ToNumber<T>) {
  return arr.reduce((acc, cur) => acc + fn(cur), 0)
}

export function reduceAvg<T>(arr: T[], fn: ToNumber<T>) {
  if (arr.length === 0) {
    return 0
  }

  const sum = reduceSum(arr, fn)
  return sum / arr.length
}

export const df = dateFns
