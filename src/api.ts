export interface ApiStatus {
  200: ['ok']
  400: ['validation-error']
  401: ['unauthorized', 'invalid-credentials', 'invalid-code']
  403: ['forbidden', 'unverified']
  404: ['not-found']
  410: ['invalid-action', 'expired-code']
  500: ['internal-server-error']
}

export type ApiStatusCode = keyof ApiStatus
export type ApiErrorCode = ApiStatus[keyof ApiStatus][number]

export interface ValidationFieldError {
  field: string
  message: string
}

export interface ApiError {
  code: ApiErrorCode
  message?: string
  fields?: ValidationFieldError[]
  details?: any
}

export interface ApiRes<T = {}> {
  success: boolean
  statusCode: ApiStatusCode
  data?: T
  error?: ApiError
}

export type Api<T = {}> = Promise<ApiRes<T>>

export function ok<T>(data?: T): ApiRes<T> {
  return {
    success: true,
    statusCode: 200,
    data,
    error: {
      code: 'ok',
    },
  }
}

export function err<T, C extends ApiStatusCode>(
  statusCode: C,
  errorCode: ApiStatus[C][number],
  details?: Partial<Omit<ApiError, 'code'>>,
): ApiRes<T> {
  return {
    success: false,
    statusCode,
    error: {
      code: errorCode,
      message: details?.message,
      fields: details?.fields,
      details: details?.details,
    },
  }
}
