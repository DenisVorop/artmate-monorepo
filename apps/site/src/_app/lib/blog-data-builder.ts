import { blogQuery, type BlogPostsResult } from "@/entities/blog";
import { getBlogPosts } from "@/shared/actions/blog";

import type { TaskFn } from "../types/data-builder";

import { BaseDataBuilder } from "./base-data-builder";

type Fields = {
  posts?: BlogPostsResult;
};

export class BlogDataBuilder<TData, TFields extends Fields> extends BaseDataBuilder<
  TData,
  TFields
> {
  add<K extends keyof TFields, V extends TFields[K]>(
    key: K,
    fn: TaskFn<TData & Partial<TFields>, V>,
  ) {
    return super.add(key, fn) as unknown as BlogDataBuilder<TData & Record<K, V>, TFields>;
  }

  withPosts() {
    const setApiResultQueryData = this.setApiResultQueryData.bind(this);

    return this.add("posts", async function () {
      return setApiResultQueryData(blogQuery.getPosts().queryKey, await getBlogPosts());
    });
  }
}
