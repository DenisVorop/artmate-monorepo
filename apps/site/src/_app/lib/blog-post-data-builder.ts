import type { BlogPostPageDataDTO } from "@/shared/actions/blog";
import { blogPostPageQuery } from "@/features/blog-post";

import type { TaskFn } from "../types/data-builder";

import { BaseDataBuilder } from "./base-data-builder";

type Fields = {
  postPage?: BlogPostPageDataDTO;
};

export class BlogPostDataBuilder<TData, TFields extends Fields> extends BaseDataBuilder<
  TData,
  TFields
> {
  add<K extends keyof TFields, V extends TFields[K]>(
    key: K,
    fn: TaskFn<TData & Partial<TFields>, V>,
  ) {
    return super.add(key, fn) as unknown as BlogPostDataBuilder<TData & Record<K, V>, TFields>;
  }

  withPostPage(slug: string) {
    const { queryClient } = this;

    return this.add("postPage", async function () {
      await queryClient.prefetchQuery(blogPostPageQuery(slug));

      return queryClient.getQueryData<BlogPostPageDataDTO>(blogPostPageQuery(slug).queryKey);
    });
  }
}
