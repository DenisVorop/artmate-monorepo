import { isApiError } from "./api-error.ts";

export type ActionResult<T> =
  | { data: T; ok: true }
  | { error: { status: number }; ok: false };

export function toActionError(
  error: unknown,
): Extract<ActionResult<never>, { ok: false }> {
  return {
    error: { status: isApiError(error) ? error.status : 503 },
    ok: false,
  };
}
