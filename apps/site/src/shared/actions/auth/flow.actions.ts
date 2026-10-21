"use server";

import { ApiResult, type ApiResultDTO } from "@/shared/lib/api-result";
import { AuthFlowTransport } from "./lib/request-flow";
import type {
  AuthFlowStateDTO,
  ProfileDraftInputDTO,
  ConfirmRegistrationCodeInputDTO,
  PasswordFlowInputDTO,
  RegistrationDraftInputDTO,
  RequestRegistrationCodeInputDTO,
} from "./flow.types";

export async function startPasswordFlow(
  input: PasswordFlowInputDTO,
): Promise<ApiResultDTO<AuthFlowStateDTO>> {
  return (
    await ApiResult.prepareApi(() =>
      AuthFlowTransport.request<AuthFlowStateDTO>("/auth/flow/password", "POST", input),
    )()
  ).toDTO() as ApiResultDTO<AuthFlowStateDTO>;
}
export async function requestRegistrationCode(
  input: RequestRegistrationCodeInputDTO,
): Promise<ApiResultDTO<AuthFlowStateDTO>> {
  return (
    await ApiResult.prepareApi(() =>
      AuthFlowTransport.request<AuthFlowStateDTO>("/auth/email-code/request", "POST", input),
    )()
  ).toDTO() as ApiResultDTO<AuthFlowStateDTO>;
}
export async function confirmRegistrationCode(
  input: ConfirmRegistrationCodeInputDTO,
): Promise<ApiResultDTO<AuthFlowStateDTO>> {
  return (
    await ApiResult.prepareApi(() =>
      AuthFlowTransport.request<AuthFlowStateDTO>("/auth/email-code/confirm", "POST", input),
    )()
  ).toDTO() as ApiResultDTO<AuthFlowStateDTO>;
}
export async function resendRegistrationCode(): Promise<ApiResultDTO<AuthFlowStateDTO>> {
  return (
    await ApiResult.prepareApi(() =>
      AuthFlowTransport.request<AuthFlowStateDTO>("/auth/email-code/resend"),
    )()
  ).toDTO() as ApiResultDTO<AuthFlowStateDTO>;
}
export async function saveRegistrationDraft(
  input: RegistrationDraftInputDTO,
): Promise<ApiResultDTO<AuthFlowStateDTO>> {
  return (
    await ApiResult.prepareApi(() =>
      AuthFlowTransport.request<AuthFlowStateDTO>("/auth/flow/registration", "POST", input),
    )()
  ).toDTO() as ApiResultDTO<AuthFlowStateDTO>;
}
export async function getAuthFlow(): Promise<ApiResultDTO<AuthFlowStateDTO>> {
  return (
    await ApiResult.prepareApi(() =>
      AuthFlowTransport.request<AuthFlowStateDTO>("/auth/flow", "GET"),
    )()
  ).toDTO() as ApiResultDTO<AuthFlowStateDTO>;
}
export async function cancelAuthFlow(): Promise<ApiResultDTO<{ status: "CANCELLED" }>> {
  return (
    await ApiResult.prepareApi(() =>
      AuthFlowTransport.request<{ status: "CANCELLED" }>("/auth/flow/cancel"),
    )()
  ).toDTO() as ApiResultDTO<{ status: "CANCELLED" }>;
}

export async function saveAuthProfileDraft(
  input: ProfileDraftInputDTO,
): Promise<ApiResultDTO<AuthFlowStateDTO>> {
  return (
    await ApiResult.prepareApi(() =>
      AuthFlowTransport.request<AuthFlowStateDTO>("/auth/flow/profile", "POST", input),
    )()
  ).toDTO() as ApiResultDTO<AuthFlowStateDTO>;
}
