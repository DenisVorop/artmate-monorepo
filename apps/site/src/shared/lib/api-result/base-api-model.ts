import { omitUndefined } from '../omit-undefined';

import { ApiError } from './api-error';
import type { ApiErrorDTO } from './api-error';
import type { ApiResult } from './api-result';

type Status = 'success' | 'error' | 'empty';

export interface ApiModelDTO<T> {
  status: Status;
  data?: T;
  error?: ApiErrorDTO;
  isSuccess: boolean;
  isEmpty: boolean;
  isError: boolean;
}

export abstract class BaseApiModel<Input, Params = unknown, Output = Input> {
  static FromApiResult<
    I,
    P,
    O,
    Constructor extends new (
      _status: Status,
      _params?: P,
      _data?: I,
      _error?: ApiError,
    ) => BaseApiModel<I, P, O>,
  >(
    this: Constructor,
    { status, data, error }: ApiResult<I>,
    params?: P,
  ): InstanceType<Constructor> {
    return new this(status, params, data, error) as InstanceType<Constructor>;
  }

  status: Status;
  isSuccess: boolean;
  isEmpty: boolean;
  isError: boolean;
  error?: ApiError;
  protected readonly params?: Params;
  private _input?: Input;
  private _output?: Output;

  constructor(status: Status, params?: Params, data?: Input, error?: ApiError) {
    this.status = status;
    this.isSuccess = status === 'success';
    this.isEmpty = status === 'empty';
    this.isError = status === 'error';
    this.params = params;
    this._input = data;
    this.error = error;
  }

  unwrap() {
    if (this.error) throw this.error;
    return this.data;
  }

  toDTO(): ApiModelDTO<Output> {
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

  protected abstract transform(_data?: Input): Output | undefined;

  protected setError(error: unknown) {
    this._setStatus('error');
    this._resetData();
    this.error = new ApiError(error);
  }

  protected setEmpty() {
    this._setStatus('empty');
    this._resetData();
  }

  private _setStatus(status: Status) {
    this.status = status;
    this.isSuccess = status === 'success';
    this.isEmpty = status === 'empty';
    this.isError = status === 'error';
  }

  private _resetData() {
    this._input = undefined;
    this._output = undefined;
  }

  get data(): Output | undefined {
    if (this.isError || this.isEmpty) return undefined;

    if (!this._output) {
      this._output = this.transform(this._input);
      return this._output;
    }

    return this._output;
  }

  set data(data: Output) {
    this._output = data;
  }
}
