import { queryOptions } from "@tanstack/react-query";

import { getFaqSections } from "@/shared/actions/faq";
import { ApiResult } from "@/shared/lib/api-result";

import type { FaqSectionsData } from "./types";

export type FaqSectionsResult = FaqSectionsData | null;

const baseKey = "faq";

export const faqQuery = {
  baseKey: [baseKey],
  getSections: () =>
    queryOptions({
      queryKey: [baseKey, "sections"] as const,
      queryFn: async () => ApiResult.fromDTO(await getFaqSections()).unwrap() ?? null,
      staleTime: Infinity,
      retryOnMount: false,
    }),
};
