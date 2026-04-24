import { faqQuery, type FaqSectionsResult } from "@/entities/faq";

import type { TaskFn } from "../types/data-builder";

import { BaseDataBuilder } from "./base-data-builder";

type Fields = {
  faqSections?: FaqSectionsResult;
};

export class FaqDataBuilder<TData, TFields extends Fields> extends BaseDataBuilder<TData, TFields> {
  add<K extends keyof TFields, V extends TFields[K]>(
    key: K,
    fn: TaskFn<TData & Partial<TFields>, V>,
  ) {
    return super.add(key, fn) as unknown as FaqDataBuilder<TData & Record<K, V>, TFields>;
  }

  withFaqSections() {
    const { queryClient } = this;

    return this.add("faqSections", async function () {
      await queryClient.prefetchQuery(faqQuery.getSections());

      return queryClient.getQueryData<FaqSectionsResult>(faqQuery.getSections().queryKey);
    });
  }
}
