import { all } from "better-all";

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
}
