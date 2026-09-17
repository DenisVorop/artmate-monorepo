import { isApiError } from "./api-error.ts";

export type ActionResult<T> =
  | { data: T; ok: true }
  | {
      error: { code?: string; status: number };
      ok: false;
    };

export function toActionError(
  error: unknown,
): Extract<ActionResult<never>, { ok: false }> {
  if (isApiError(error)) {
    return {
      error: {
        ...(error.code ? { code: error.code } : {}),
        status: error.status,
      },
      ok: false,
    };
  }

  return {
    error: { status: 503 },
    ok: false,
  };
}
