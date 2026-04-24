import { BaseDataBuilder } from "@/app/lib/base-data-builder";
import type { TaskFn } from "@/app/types/data-builder";
import { blogPostPageQuery } from "./query";

type Fields = {
  prefetchPostPage: void;
};

export class DataBuilder<TData, TFields extends Fields> extends BaseDataBuilder<
  TData,
  TFields
> {
  add<K extends keyof TFields, V extends TFields[K]>(key: K, fn: TaskFn<TData & Partial<TFields>, V>) {
    return super.add(key, fn) as unknown as DataBuilder<TData & Record<K, V>, TFields>;
  }

  prefetchPostPage(slug: string) {
    const { queryClient } = this;

    return this.add("prefetchPostPage", async function () {
      return queryClient.prefetchQuery(blogPostPageQuery(slug));
    });
  }
}
