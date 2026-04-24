'use server';

import { ApiResult, type ApiResultDTO } from "@/shared/lib/api-result";

import { faqSectionsData, type FaqSectionsData } from "./faq.data";

export async function getFaqSections(): Promise<ApiResultDTO<FaqSectionsData>> {
  const result = await ApiResult.prepareApi(async () => faqSectionsData, {
    isEmptyCb: (data) => data.items.length === 0,
  })();

  return result.toDTO() as ApiResultDTO<FaqSectionsData>;
}
