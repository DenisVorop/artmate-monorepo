import type { ActionResult } from "@/shared/lib/action-result";

export type AchievementMutationError = Error & { status?: number };

export function unwrapAchievementMutation<T>(result: ActionResult<T>) {
  if (result.ok) return result.data;

  const error = new Error(
    result.status === 409
      ? "Ачивка уже изменена. Перезагрузите страницу и повторите действие."
      : result.error,
  ) as AchievementMutationError;
  error.status = result.status;
  throw error;
}
