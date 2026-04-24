'use client';

import { createContext, useContext } from 'react';

type SearchValue = string | string[] | undefined;
export type SearchParams = Record<string, SearchValue>;

export type TQueryStateContext<T extends SearchParams> = [
  searchParams: T,
  methods: {
    /** Добавить параметр. Если такой ключ уже есть, то его значение будет заменено. */
    add<K extends keyof T>(_key: K, _value: Exclude<T[K], undefined>): void;
    /** Массовое добавление параметров. Значения, по совпадающим ключам, будут заменены. */
    addMany<K extends keyof T>(_newEntries: Record<K, Exclude<T[K], undefined>>): void;
    /** Обновить существующий или добавить новый параметр. */
    update<K extends keyof T>(_key: K, _value: Exclude<T[K], undefined>): void;
    /** Массовое обновление параметров */
    updateMany<K extends keyof T>(_newEntries: Record<K, Exclude<T[K], undefined>>): void;
    /** Прочитать параметр */
    get<K extends keyof T>(_key: K): T[K];
    /** Удалить параметр */
    remove<K extends keyof T>(_key: K): void;
    /** Массовое удаление параметров */
    removeMany<K extends keyof T>(_keys: K[]): void;
    /** Удалить значение из параметра */
    removeValue<K extends keyof T>(_key: K, _value: string): void;
    /** Проверить наличие параметра */
    has<K extends keyof T>(_key: K): boolean | undefined;
    /** Очистить все параметры */
    clear(): void;
  },
];

const stub = () => {
  throw new Error('<QueryStateContextProvider> not found.');
};

export const QueryStateContext = createContext<TQueryStateContext<SearchParams>>([
  {} as SearchParams,
  {
    add: stub,
    addMany: stub,
    update: stub,
    updateMany: stub,
    get: stub,
    remove: stub,
    removeMany: stub,
    removeValue: stub,
    has: stub,
    clear: stub,
  },
]);

QueryStateContext.displayName = 'QueryStateContext';

export function useQueryState<T extends SearchParams>() {
  return useContext(QueryStateContext) as unknown as TQueryStateContext<T>;
}
