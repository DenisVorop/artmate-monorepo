import type { AuthReadinessDTO } from "./flow.types";

export type YandexStartDTO = { attemptId: string; authorizationUrl: string };
export type YandexCallbackInputDTO = { state: string; code?: string; error?: string };
export type YandexResultDTO =
  | { attemptId: string; status: "WAITING" }
  | { attemptId: string; status: "PENDING"; state: AuthReadinessDTO }
  | { attemptId: string; status: "REJECTED"; errorCode: string };
