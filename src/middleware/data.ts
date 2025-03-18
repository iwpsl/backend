import type { NextFunction, Request, Response } from 'express'
import type { ApiRes } from '../api'

export function dataMiddleware(_req: Request, res: Response, next: NextFunction) {
  const ogJson = res.json
  const ogStatus = res.status

  res.json = function (body: ApiRes<unknown>) {
    const x = ogStatus.call(this, body.statusCode)
    return ogJson.call(x, body)
  }

  next()
}
