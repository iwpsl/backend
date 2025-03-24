export type ApiError =
  | 'not-found'
  | 'forbidden'
  | 'unauthorized'
  | 'internal-server-error'
  | 'unverified'
  | 'invalid-credentials'
  | 'invalid-action'
  | 'expired-code'
  | 'invalid-code'

export interface ApiRes<T = {}> {
  success: boolean
  statusCode: number
  data: T | null
  error: ApiError | null
}

export type Api<T = {}> = Promise<ApiRes<T>>

export function ok<T>(data?: T): ApiRes<T> {
  return {
    success: true,
    statusCode: 200,
    data: data ?? null,
    error: null,
  }
}

export function err<T>(statusCode: number, error: ApiError, data?: T): ApiRes<T> {
  return {
    success: false,
    statusCode,
    error: error ?? null,
    data: data ?? null,
  }
}
