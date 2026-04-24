'use server';

import { faqSectionsData } from "@/entities/faq/model";
import type { FaqSectionsData } from "@/entities/faq/model";
import { ApiResult, type ApiResultDTO } from "@/shared/lib/api-result";

export async function getFaqSections(): Promise<ApiResultDTO<FaqSectionsData>> {
  const result = await ApiResult.prepareApi(async () => faqSectionsData, {
    isEmptyCb: (data) => data.items.length === 0,
  })();

  return result.toDTO() as ApiResultDTO<FaqSectionsData>;
}
