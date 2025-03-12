import { NextFunction, Request, Response } from 'express'

export class ResponseError<T> extends Error {
  status: number
  extra?: T

  constructor(status: number, message: string, extra?: T) {
    super(message)
    this.status = status
    this.extra = extra
  }
}

export function errorMiddleware(err: any, _req: Request, res: Response, next: NextFunction): void {
  if (err instanceof ResponseError) {
    res.status(err.status).json({
      error: err.message,
      stack: process.env.ENVIRONMENT === 'dev' ? err.stack : undefined,
      ...err.extra
    })
  } else if (err instanceof Error) {
    res.status(500).json({
      error: 'Internal server errror',
      stack: process.env.ENVIRONMENT === 'dev' ? err.stack : undefined
    })
  } else {
    next()
  }
}
