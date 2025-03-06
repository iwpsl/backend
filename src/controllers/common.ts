export type OkResponse = {
  message: string
}

export type ErrorResponse = {
  error: string
}

export type MaybeResponse<T> = T | ErrorResponse
export type MaybePromise<T> = Promise<MaybeResponse<T>>
export type MaybeOkResponse = MaybeResponse<OkResponse>
export type MaybeOkPromise = Promise<MaybeOkResponse>
