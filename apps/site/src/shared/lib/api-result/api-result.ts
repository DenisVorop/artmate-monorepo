import _isEmpty from 'lodash/isEmpty';

import { omitUndefined } from '../omit-undefined';

import { ApiError, type ApiErrorDTO } from './api-error';

type Status = 'success' | 'error' | 'empty';

export type ApiResultDTO<T> = {
  status: Status;
  data?: T;
  error?: ApiErrorDTO;
  isSuccess: boolean;
  isEmpty: boolean;
  isError: boolean;
};

type Options<R> = {
  isEmptyCb?: (_dto: R) => boolean;
};

export class ApiResult<T> {
  static prepareApi<P extends unknown[], R>(
    api: (..._params: P) => Promise<R>,
    options: Options<R> = {},
  ) {
    const { isEmptyCb } = options;

    return async (...params: P): Promise<ApiResult<R | undefined>> => {
      try {
        const r = await api(...params);
        return (isEmptyCb ?? _isEmpty)(r) ? ApiResult.empty(r) : new ApiResult('success', r);
      } catch (error: unknown) {
        return ApiResult.error(error);
      }
    };
  }

  static empty<T>(dto: T): ApiResult<T> {
    return new ApiResult('empty', dto);
  }

  static error(error: unknown): ApiResult<undefined> {
    const _error = new ApiError(error);
    return new ApiResult('error', undefined, _error);
  }

  static fromDTO<T>(dto: ApiResultDTO<T>): ApiResult<T> {
    return new ApiResult(dto.status, dto.data, dto.error ? new ApiError(dto.error) : undefined);
  }

  isSuccess: boolean;
  isEmpty: boolean;
  isError: boolean;
  status: Status;
  data?: T;
  error?: ApiError;

  protected constructor(status: Status, data?: T, error?: ApiError) {
    this.status = status;
    this.data = data;
    this.error = error;
    this.isSuccess = status === 'success';
    this.isEmpty = status === 'empty';
    this.isError = status === 'error';
  }

  unwrap() {
    if (this.error) {
      throw this.error;
    }

    return this.data;
  }

  toDTO(): ApiResultDTO<T> {
    return omitUndefined({
      status: this.status,
      data: this.data,
      error: this.error?.toDTO(),
      isSuccess: this.isSuccess,
      isEmpty: this.isEmpty,
      isError: this.isError,
    });
  }

  /** Данный метод автоматически вызывается при JSON.stringify(instance) */
  toJSON() {
    return this.toDTO();
  }
}
