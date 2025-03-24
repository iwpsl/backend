import type { NextFunction, Request, Response } from 'express'
import { err } from '../api'
import { isDev } from '../utils'

export function errorMiddleware(e: any, _req: Request, res: Response, next: NextFunction): void {
  if (e instanceof Error) {
    res.json(err(500, 'internal-server-error', {
      stack: isDev ? e.stack : undefined,
    }))
  } else {
    next()
  }
}
