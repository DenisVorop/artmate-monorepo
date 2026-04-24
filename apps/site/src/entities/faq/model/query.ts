import { queryOptions } from "@tanstack/react-query";

import { getFaqSections } from "@/shared/actions/faq";
import type { ApiResultDTO } from "@/shared/lib/api-result";

import type { FaqSectionsData } from "@/entities/faq/model";

export type FaqSectionsResult = ApiResultDTO<FaqSectionsData>;

const baseKey = "faq";

export const faqQuery = {
  baseKey: [baseKey],
  getSections: () =>
    queryOptions({
      queryKey: [baseKey, "sections"] as const,
      queryFn: () => getFaqSections(),
      staleTime: Infinity,
    }),
};
