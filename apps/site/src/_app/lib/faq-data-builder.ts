import { faqQuery, type FaqSectionsResult } from "@/entities/faq";
import { getFaqSections } from "@/shared/actions/faq";

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
    const setApiResultQueryData = this.setApiResultQueryData.bind(this);

    return this.add("faqSections", async function () {
      return setApiResultQueryData(
        faqQuery.getSections().queryKey,
        await getFaqSections(),
      );
    });
  }
}
