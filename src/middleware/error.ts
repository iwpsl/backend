import type { NextFunction, Request, Response } from 'express'
import { isDev } from '../utils'

export function errorMiddleware(err: any, _req: Request, res: Response, next: NextFunction): void {
  if (err instanceof Error) {
    res.status(500).json({
      error: 'Internal server errror',
      stack: isDev ? err.stack : undefined,
    })
  } else {
    next()
  }
}
