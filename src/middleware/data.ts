import type { NextFunction, Request, Response } from 'express'

export function dataMiddleware(_req: Request, res: Response, next: NextFunction) {
  const ogJson = res.json
  const ogStatus = res.status

  res.json = function (body: { statusCode?: number }) {
    // eslint-disable-next-line ts/no-this-alias
    let x = this
    if (body.statusCode)
      x = ogStatus.call(this, body.statusCode)
    return ogJson.call(x, body)
  }

  next()
}
