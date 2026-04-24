import { queryOptions } from "@tanstack/react-query";

import { getFaqSections } from "@/shared/actions/faq";
import type { ApiResultDTO } from "@/shared/lib/api-result";

import { emptyFaqSectionsData, type FaqSectionsData } from "@/entities/faq/model";

export type FaqSectionsResult = ApiResultDTO<FaqSectionsData>;

const baseKey = "faq";

const initialData: FaqSectionsResult = {
  status: "empty",
  data: emptyFaqSectionsData,
  isSuccess: false,
  isEmpty: true,
  isError: false,
};

export const faqQuery = {
  baseKey: [baseKey],
  getSections: () =>
    queryOptions({
      queryKey: [baseKey, "sections"] as const,
      queryFn: () => getFaqSections(),
      initialData,
      staleTime: Infinity,
    }),
};
