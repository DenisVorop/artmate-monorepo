export function reportMutationError(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Не удалось сохранить изменения";

  window.alert(message);
}
