import { AxiosError } from 'axios';

import { omitUndefined } from '../omit-undefined';

export type ApiErrorDTO = {
  message: string;
  name: string;
  status?: number;
};

export class ApiError extends Error {
  /** Код ошибки (напр. 500) */
  status?: number;

  constructor(error: unknown) {
    super(getErrorMessage(error));
    this.name = 'ApiError';
    this.stack = error instanceof Error ? error.stack : new Error().stack;
    this.status = getErrorStatus(error);
  }

  toDTO(): ApiErrorDTO {
    return omitUndefined({
      message: this.message,
      name: this.name,
      status: this.status,
    });
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (isErrorRecord(error) && typeof error.message === 'string') {
    return error.message;
  }

  return 'Unknown error';
}

function getErrorStatus(error: unknown) {
  if (error instanceof AxiosError) {
    return error.response?.status ?? 500;
  }

  if (!isErrorRecord(error)) {
    return 500;
  }

  const response = isErrorRecord(error.response) ? error.response : undefined;
  const status = response?.status ?? error.status ?? error.statusCode;

  return typeof status === 'number' ? status : 500;
}

function isErrorRecord(error: unknown): error is Record<string, unknown> {
  return typeof error === 'object' && error !== null;
}
