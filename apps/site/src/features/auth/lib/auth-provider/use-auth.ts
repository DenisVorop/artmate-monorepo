"use client";
import type { AuthOptions } from "../auth-flow-state";
import { useAuthRequest } from "./use-auth-request";
export type { AuthTrigger } from "./use-auth-request";

export function useAuth<Payload = void>(options: AuthOptions<Payload> = {}) {
  return useAuthRequest(options);
}
