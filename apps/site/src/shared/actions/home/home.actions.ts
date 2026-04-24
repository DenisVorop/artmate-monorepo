'use server';

import { homeData } from "@/entities/home/model";
import type { HomeData } from "@/entities/home/model";
import { ApiResult, type ApiResultDTO } from "@/shared/lib/api-result";

export async function getHomeData(): Promise<ApiResultDTO<HomeData>> {
  const result = await ApiResult.prepareApi(async () => homeData, {
    isEmptyCb: (data) => data.howItWorksSteps.length === 0,
  })();

  return result.toDTO() as ApiResultDTO<HomeData>;
}
