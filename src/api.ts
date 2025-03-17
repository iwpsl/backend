export type ApiRes<T> = {
  success: boolean
  statusCode: number
  data: T | null
  error: string | null
}

export type Api<T> = Promise<ApiRes<T>>
export type SimpleRes = ApiRes<undefined>
export type SimpleApi = Promise<SimpleRes>

export function ok<T>(data?: T): ApiRes<T> {
  return {
    success: true,
    statusCode: 200,
    data: data ?? null,
    error: null
  }
}

export function err<T>(statusCode: number, error: string, data?: T): ApiRes<T> {
  return {
    success: false,
    statusCode,
    error: error ?? null,
    data: data ?? null
  }
}
