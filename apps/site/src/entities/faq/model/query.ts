import { queryOptions } from "@tanstack/react-query";

import { getFaqSections } from "@/shared/actions/faq";
import { ensureApiResult, type ApiResultDTO } from "@/shared/lib/api-result";

import type { FaqSectionsData } from "./types";

export type FaqSectionsResult = ApiResultDTO<FaqSectionsData>;

const baseKey = "faq";

export const faqQuery = {
  baseKey: [baseKey],
  getSections: () =>
    queryOptions({
      queryKey: [baseKey, "sections"] as const,
      queryFn: async () => ensureApiResult(await getFaqSections()),
      staleTime: Infinity,
    }),
};
