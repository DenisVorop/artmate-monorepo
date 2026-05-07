export function getAuthErrorMessage(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Не удалось выполнить запрос";

  if (message === "Invalid email or password") {
    return "Неверный email или пароль";
  }

  if (message === "Admin role required") {
    return "У этой учетной записи нет доступа к админ-панели";
  }

  if (message.startsWith("Too many login attempts. Try again later")) {
    const retryAfterSeconds = getRetryAfterSeconds(message);

    return retryAfterSeconds
      ? `Слишком много попыток входа. Попробуйте через ${formatRetryAfter(retryAfterSeconds)}.`
      : "Слишком много попыток входа. Попробуйте позже.";
  }

  if (message.includes("AUTH_JWT_SECRET")) {
    return "API авторизации не настроен: нужен AUTH_JWT_SECRET";
  }

  if (message.includes("fetch failed")) {
    return "API авторизации недоступен";
  }

  return message;
}

function getRetryAfterSeconds(message: string) {
  const match = message.match(/Retry after (?<seconds>\d+) seconds$/);
  const seconds = Number(match?.groups?.seconds);

  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
}

function formatRetryAfter(totalSeconds: number) {
  if (totalSeconds < 60) {
    return `${totalSeconds} сек.`;
  }

  return `${Math.ceil(totalSeconds / 60)} мин.`;
}
