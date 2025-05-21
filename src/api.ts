import type { FieldErrors } from 'tsoa'

/**
 * Stringified UUIDv4.
 * See [RFC 4122](https://tools.ietf.org/html/rfc4122)
 * @pattern [0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-4[0-9A-Fa-f]{3}-[89ABab][0-9A-Fa-f]{3}-[0-9A-Fa-f]{12}
 * @format uuid
 */
export type UUID = string

export type ApiError =
  | 'validation-error'
  | 'not-found'
  | 'forbidden'
  | 'unauthorized'
  | 'internal-server-error'
  | 'unverified'
  | 'invalid-credentials'
  | 'invalid-action'
  | 'expired-code'
  | 'invalid-code'
  | 'invalid-file-type'
  | 'file-too-large'
  // challenges
  | 'challenge-already-joined'
  | 'challenge-not-joined'
  | 'task-wrong-day'
  | 'task-already-finished'
  // connection
  | 'connection-already-requested'
  | 'connection-they-requested'
  | 'connection-not-for-you'
  // fasting
  | 'fasting-already-running'
  // auth
  | 'auth-invalid-login-method'

export interface ApiRes<T = {}> {
  success: boolean
  statusCode: number
  data: T | null
  error: ApiError | null
  validationErrors: FieldErrors | null
  stack: string | null
}

export type Api<T = {}> = Promise<ApiRes<T>>

export function ok<T>(data?: T): ApiRes<T> {
  return {
    success: true,
    statusCode: 200,
    data: data ?? null,
    error: null,
    validationErrors: null,
    stack: null,
  }
}

export function err<T>(
  statusCode: number,
  error: ApiError,
  extra?: Partial<Omit<ApiRes<T>, 'success' | 'statusCode' | 'error'>>,
): ApiRes<T> {
  return {
    success: false,
    statusCode,
    error: error ?? null,
    data: extra?.data ?? null,
    validationErrors: extra?.validationErrors ?? null,
    stack: extra?.stack ?? null,
  }
}
