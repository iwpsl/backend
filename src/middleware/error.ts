import type { NextFunction, Request, Response } from 'express'
import { err } from '../api.js'
import { isDev } from '../utils.js'

export function errorMiddleware(e: any, _req: Request, res: Response, next: NextFunction): void {
  console.log(e)

  if (e instanceof Error) {
    res.json(err(500, 'internal-server-error', {
      stack: isDev ? e.stack : undefined,
    }))
  } else {
    next(e)
  }
}
