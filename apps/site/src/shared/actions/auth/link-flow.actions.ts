"use server";
import { ApiResult, type ApiResultDTO } from "@/shared/lib/api-result";
import { AuthFlowTransport } from "./lib/request-flow";
import type {
  ActivationPasswordDraftInputDTO,
  AuthFlowStateDTO,
  ConfirmRecoveryPasswordInputDTO,
  ExchangeOrderActivationInputDTO,
  RecoveryFlowInputDTO,
  RecoveryFlowResultDTO,
} from "./flow.types";

export async function prepareAuthContinuation(): Promise<ApiResultDTO<{ status: "READY" }>> {
  return (
    await ApiResult.prepareApi(() =>
      AuthFlowTransport.request<{ status: "READY" }>("/auth/flow/prepare", "POST"),
    )()
  ).toDTO() as ApiResultDTO<{ status: "READY" }>;
}

export async function exchangeOrderActivation(
  input: ExchangeOrderActivationInputDTO,
): Promise<ApiResultDTO<AuthFlowStateDTO>> {
  return (
    await ApiResult.prepareApi(() =>
      AuthFlowTransport.request<AuthFlowStateDTO>(
        "/auth/flow/order-activation/exchange",
        "POST",
        input,
      ),
    )()
  ).toDTO() as ApiResultDTO<AuthFlowStateDTO>;
}

export async function saveActivationPassword(
  input: ActivationPasswordDraftInputDTO,
): Promise<ApiResultDTO<AuthFlowStateDTO>> {
  return (
    await ApiResult.prepareApi(() =>
      AuthFlowTransport.request<AuthFlowStateDTO>(
        "/auth/flow/order-activation/password",
        "POST",
        input,
      ),
    )()
  ).toDTO() as ApiResultDTO<AuthFlowStateDTO>;
}

export async function requestFlowRecovery(
  input: RecoveryFlowInputDTO,
): Promise<ApiResultDTO<RecoveryFlowResultDTO>> {
  return (
    await ApiResult.prepareApi(() =>
      AuthFlowTransport.request<RecoveryFlowResultDTO>(
        "/auth/flow/recovery/request",
        "POST",
        input,
      ),
    )()
  ).toDTO() as ApiResultDTO<RecoveryFlowResultDTO>;
}

export async function confirmRecoveryPassword(
  input: ConfirmRecoveryPasswordInputDTO,
): Promise<ApiResultDTO<RecoveryFlowResultDTO>> {
  return (
    await ApiResult.prepareApi(() =>
      AuthFlowTransport.request<RecoveryFlowResultDTO>(
        "/auth/flow/password-reset/confirm",
        "POST",
        input,
      ),
    )()
  ).toDTO() as ApiResultDTO<RecoveryFlowResultDTO>;
}
