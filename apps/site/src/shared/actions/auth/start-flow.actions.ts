"use server";
import { ApiResult, type ApiResultDTO } from "@/shared/lib/api-result";
import { AuthFlowTransport } from "./lib/request-flow";
import type { AuthFlowStateDTO } from "./flow.types";

export async function startAuthFlow(): Promise<ApiResultDTO<AuthFlowStateDTO>> {
  return (
    await ApiResult.prepareApi(() => AuthFlowTransport.start<AuthFlowStateDTO>())()
  ).toDTO() as ApiResultDTO<AuthFlowStateDTO>;
}
