'use client';

import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { useCallback, useMemo } from 'react';

import { useStableCallback } from '../hooks/use-stable-callback';
import { objectEntries } from '../object-entries';

import { QueryStateContext } from './query-state.context';
import type { TQueryStateContext, SearchParams } from './query-state.context';

export function QueryStateProvider({ children }: { children?: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateURLParams = useCallback(
    (newParams: SearchParams) => {
      const queryString = new URLSearchParams();
      objectEntries(newParams).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach((v) => {
            queryString.append(key, v);
          });
        } else if (typeof value === 'string') {
          queryString.append(key, value);
        }
      });

      const search = queryString.toString();
      const url = search ? `?${search}` : pathname;
      router.replace(url as Route, { scroll: false });
    },
    [pathname, router],
  );

  /** Добавить параметр. Если такой ключ уже есть, то его значение будет заменено. */
  const add = useCallback(
    (key: string, value: string) => {
      const newParams = { ...Object.fromEntries(searchParams.entries()) };
      newParams[key] = value;
      updateURLParams(newParams);
    },
    [searchParams, updateURLParams],
  );

  /** Массовое добавление параметров. Значения, по совпадающим ключам, будут заменены. */
  const addMany = useCallback(
    (newEntries: Record<string, string | string[]>) => {
      const newParams = { ...Object.fromEntries(searchParams.entries()) } as SearchParams;
      objectEntries(newEntries).forEach(([key, value]) => {
        newParams[key] = value;
      });
      updateURLParams(newParams);
    },
    [searchParams, updateURLParams],
  );

  /** Обновить существующий или добавить новый параметр. */
  const update = useCallback(
    (key: string, value: string | string[]) => {
      const patch = patchParams(Object.fromEntries(searchParams.entries()), key, value);
      updateURLParams(patch);
    },
    [searchParams, updateURLParams],
  );

  /** Массовое обновление параметров */
  const updateMany = useCallback(
    (newEntries: Record<string, string | string[]>) => {
      const patch = Object.entries(newEntries).reduce((acc, [key, value]) => {
        const p = patchParams(acc, key, value);
        return { ...acc, ...p };
      }, Object.fromEntries(searchParams.entries()) as SearchParams);
      updateURLParams(patch);
    },
    [searchParams, updateURLParams],
  );

  /** Прочитать параметр */
  const get = useCallback(
    (key: string): string | string[] | undefined => searchParams.get(key) ?? undefined,
    [searchParams],
  );

  /** Удалить параметр */
  const remove = useCallback(
    (key: string) => {
      const { [key]: _, ...rest } = Object.fromEntries(searchParams.entries());
      updateURLParams(rest);
    },
    [searchParams, updateURLParams],
  );

  /** Массовое удаление параметров */
  const removeMany = useCallback(
    (keys: string[]) => {
      const newParams = Object.fromEntries(
        Array.from(searchParams.entries()).filter(([k]) => !keys.includes(k)),
      );
      updateURLParams(newParams);
    },
    [searchParams, updateURLParams],
  );

  /** Удалить значение из параметра */
  const removeValue = useStableCallback((key: string, value: string) => {
    if (searchParams.get(key) === value) {
      remove(key);
      return;
    }

    if (Array.isArray(searchParams.get(key))) {
      const newValues = searchParams.getAll(key).filter((v) => v !== value);

      if (newValues.length === 0) {
        /** Удаляем весь ключ, если массив стал пустым */
        remove(key);
      } else {
        const newParams = { ...Object.fromEntries(searchParams.entries()), [key]: newValues };
        updateURLParams(newParams);
      }
    }
  });

  /** Проверить наличие параметра */
  const has = useStableCallback((key: string): boolean => searchParams.has(key));

  /** Очистить все параметры */
  const clear = useCallback(() => {
    updateURLParams({});
  }, [updateURLParams]);

  const methods = useMemo(
    () => ({ add, addMany, update, updateMany, get, remove, removeMany, removeValue, has, clear }),
    [add, addMany, clear, get, has, remove, removeMany, removeValue, update, updateMany],
  );

  const ctx = useMemo<TQueryStateContext<SearchParams>>(
    () => [Object.fromEntries(searchParams.entries()), methods],
    [methods, searchParams],
  );

  return <QueryStateContext.Provider value={ctx}>{children}</QueryStateContext.Provider>;
}

function patchParams(params: SearchParams, key: string, value: string | string[]): SearchParams {
  const patchingParams = { ...params };
  if (!patchingParams[key]) patchingParams[key] = value;
  if (typeof patchingParams[key] === 'string') {
    if (typeof value === 'string') {
      patchingParams[key] = [...new Set([patchingParams[key], value])];
    } else if (Array.isArray(value)) {
      patchingParams[key] = [...new Set([patchingParams[key], ...value])];
    }
  }
  if (Array.isArray(patchingParams[key])) {
    if (typeof value === 'string') {
      patchingParams[key] = [...new Set([...patchingParams[key], value])];
    } else if (Array.isArray(value)) {
      patchingParams[key] = [...new Set([...patchingParams[key], ...value])];
    }
  }

  return patchingParams;
}
