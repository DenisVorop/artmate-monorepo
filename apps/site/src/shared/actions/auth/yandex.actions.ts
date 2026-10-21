"use server";
import { ApiResult, type ApiResultDTO } from "@/shared/lib/api-result";
import { AuthFlowTransport } from "./lib/request-flow";
import type { YandexCallbackInputDTO, YandexResultDTO, YandexStartDTO } from "./yandex.types";

export async function startYandexFlow(): Promise<ApiResultDTO<YandexStartDTO>> {
  return (
    await ApiResult.prepareApi(() =>
      AuthFlowTransport.oauth<YandexStartDTO>("/auth/flow/yandex/start", "POST"),
    )()
  ).toDTO() as ApiResultDTO<YandexStartDTO>;
}
export async function finishYandexFlow(
  input: YandexCallbackInputDTO,
): Promise<ApiResultDTO<YandexResultDTO>> {
  return (
    await ApiResult.prepareApi(() =>
      AuthFlowTransport.oauth<YandexResultDTO>("/auth/flow/yandex/callback", "POST", input),
    )()
  ).toDTO() as ApiResultDTO<YandexResultDTO>;
}
export async function readYandexFlow(attemptId: string): Promise<ApiResultDTO<YandexResultDTO>> {
  return (
    await ApiResult.prepareApi(() =>
      AuthFlowTransport.oauth<YandexResultDTO>(
        `/auth/flow/yandex/result?attemptId=${encodeURIComponent(attemptId)}`,
        "GET",
      ),
    )()
  ).toDTO() as ApiResultDTO<YandexResultDTO>;
}
