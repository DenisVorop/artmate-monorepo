import { routes } from "@/shared/constants";
import { apiCsrfHeader } from "@/shared/lib/api-security";
import { ApiResult, type ApiResultDTO } from "@/shared/lib/api-result";
import type { LogoutDTO } from "./auth.types";

/** Runs in the browser so every Set-Cookie reaches the browser unchanged. */
export async function logout(): Promise<ApiResultDTO<LogoutDTO>> {
  const result = await ApiResult.prepareApi(async () => {
    const response = await fetch(routes.authLogout, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: apiCsrfHeader,
    });
    if (!response.ok) throw new Error("Logout request failed");
    return { ok: true };
  })();
  return result.toDTO() as ApiResultDTO<LogoutDTO>;
}
