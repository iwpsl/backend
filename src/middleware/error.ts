import type { NextFunction, Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { ValidateError } from 'tsoa'
import { err } from '../api.js'
import { isDev } from '../utils.js'

function r(_v: any) {}

export function errorMiddleware(e: any, _req: Request, res: Response, next: NextFunction): void {
  console.log(e)

  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    // failed to update since no matching entries
    if (e.code === 'P2025') {
      return r(res.json(err(404, 'not-found')))
    }
  }

  if (e instanceof ValidateError) {
    return r(res.json(err(400, 'validation-error', {
      validationErrors: e.fields,
    })))
  }

  if (e instanceof Error) {
    let response = res.json(err(500, 'internal-server-error'))

    if (isDev && e.stack) {
      response = response.header('Wrsf-stacktrace', e.stack)
    }

    return r(response)
  }

  next(e)
}
