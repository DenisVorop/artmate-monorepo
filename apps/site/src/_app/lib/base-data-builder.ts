import { all } from "better-all";
import type { QueryKey } from "@tanstack/react-query";

import { ApiResult, type ApiResultDTO } from "@/shared/lib/api-result";
import { getQueryClient } from "@/shared/lib/query-client";

import type { TaskFn } from "../types/data-builder";

type Tasks = Record<string, () => Promise<unknown>>;

type QueryClient = ReturnType<typeof getQueryClient>;

type BuilderCtor = new (
  _childClass?: BuilderCtor,
  _tasks?: Tasks,
  _queryClient?: QueryClient,
) => unknown;

export class BaseDataBuilder<TData, TFields extends object> {
  tasks: Tasks = {};
  queryClient: QueryClient;

  private readonly childClass!: BuilderCtor;

  constructor(
    childClass: BuilderCtor = this.constructor as BuilderCtor,
    tasks?: Tasks,
    queryClient?: QueryClient,
  ) {
    this.childClass = childClass;
    this.tasks = tasks ?? this.tasks;
    this.queryClient = queryClient ?? getQueryClient();
  }

  add<K extends keyof TFields, V extends TFields[K]>(
    key: K,
    fn: TaskFn<TData & Partial<TFields>, V>,
  ): BaseDataBuilder<TData & Record<K, V>, TFields> {
    const nextTasks = { ...this.tasks, [key]: fn } as Tasks;

    const next = new this.childClass(this.childClass, nextTasks, this.queryClient);

    return next as BaseDataBuilder<TData & Record<K, V>, TFields>;
  }

  async build() {
    const data = await all(this.tasks);

    return {
      ...data,
      queryClient: this.queryClient,
    } as TData & { queryClient: QueryClient };
  }

  protected setApiResultQueryData<T>(queryKey: QueryKey, result: ApiResultDTO<T>) {
    const apiResult = ApiResult.fromDTO(result);

    if (apiResult.isError) {
      const error = apiResult.error ?? new Error("Unknown API error");
      const queryCache = this.queryClient.getQueryCache();
      const query = queryCache.find({ queryKey }) ?? queryCache.build(this.queryClient, { queryKey });

      query.setState({
        data: undefined,
        dataUpdateCount: 0,
        dataUpdatedAt: 0,
        error,
        errorUpdateCount: 1,
        errorUpdatedAt: Date.now(),
        fetchFailureCount: 1,
        fetchFailureReason: error,
        fetchMeta: null,
        isInvalidated: false,
        status: "error",
        fetchStatus: "idle",
      });

      return undefined;
    }

    const data = apiResult.data ?? null;
    this.queryClient.setQueryData(queryKey, data);

    return data;
  }
}
