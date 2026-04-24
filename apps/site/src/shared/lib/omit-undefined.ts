import _isUndefined from 'lodash/isUndefined';
import _omitBy from 'lodash/omitBy';

export function omitUndefined<T extends Record<string, unknown>>(obj: T): T {
  return _omitBy(obj, _isUndefined) as T;
}
