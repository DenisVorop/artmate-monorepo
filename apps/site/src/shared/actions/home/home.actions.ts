'use server';

import { ApiResult, type ApiResultDTO } from "@/shared/lib/api-result";

import { homeData, type HomeData } from "./home.data";

export async function getHomeData(): Promise<ApiResultDTO<HomeData>> {
  const result = await ApiResult.prepareApi(async () => homeData, {
    isEmptyCb: (data) => data.howItWorksSteps.length === 0,
  })();

  return result.toDTO() as ApiResultDTO<HomeData>;
}
