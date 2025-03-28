import type { ClassConstructor } from 'class-transformer'
import type { NextFunction, Request, Response } from 'express'
import type { ValidationFieldError } from '../api.js'
import { plainToInstance } from 'class-transformer'
import * as cv from 'class-validator'
import { ValidateError } from 'tsoa'
import { err } from '../api.js'

export function validate<T extends object>(clazz: ClassConstructor<T>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const instance = plainToInstance(clazz, req.body)
    const errors = await cv.validate(instance, {
      forbidUnknownValues: true,
      validationError: {
        target: false,
      },
    })

    if (errors.length === 0)
      return next()

    const fieldErrors: ValidationFieldError[] = []
    for (const { constraints, property } of errors) {
      if (constraints) {
        fieldErrors.push({
          field: property,
          message: Object.values(constraints).join(', '),
        })
      }
    }

    res.json(err(400, 'validation-error', {
      fields: fieldErrors,
    }))
  }
}

export function validateError(e: any, _req: Request, res: Response, next: NextFunction) {
  if (e instanceof ValidateError) {
    res.json(err(400, 'validation-error', {
      fields: Object.entries(e.fields).map(([k, v]) => ({
        field: k,
        message: v.message,
      })),
    }))
  } else {
    next(e)
  }
}
