"use server";
import { ApiResult, type ApiResultDTO } from "@/shared/lib/api-result";
import { AuthFlowTransport } from "./lib/request-flow";
import type { AuthReadinessDTO, CompleteAuthFlowInputDTO } from "./flow.types";

export async function completeAuthFlow(
  input: CompleteAuthFlowInputDTO,
): Promise<ApiResultDTO<AuthReadinessDTO>> {
  return (
    await ApiResult.prepareApi(() => AuthFlowTransport.complete<AuthReadinessDTO>(input))()
  ).toDTO() as ApiResultDTO<AuthReadinessDTO>;
}
export async function resumeAuthFlow(): Promise<ApiResultDTO<AuthReadinessDTO>> {
  return (
    await ApiResult.prepareApi(() => AuthFlowTransport.resume<AuthReadinessDTO>())()
  ).toDTO() as ApiResultDTO<AuthReadinessDTO>;
}
