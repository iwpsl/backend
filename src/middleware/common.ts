import type { Response } from 'express'

export function err(res: Response, status: number, error: string) {
  res.status(status).json({ error })
}
