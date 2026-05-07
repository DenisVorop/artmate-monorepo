import { decline } from "@/shared/lib";

export function getAuthErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Не удалось выполнить запрос";

  if (message === "Invalid login or password") {
    return "Неверный логин или пароль";
  }

  if (message === "Email is not verified") {
    return "Подтвердите почту, чтобы войти";
  }

  if (message === "Invalid verification code") {
    return "Неверный код подтверждения";
  }

  if (message === "Verification code expired") {
    return "Код истек. Отправьте новый код.";
  }

  if (message === "Verification code attempts exceeded") {
    return "Слишком много неверных попыток. Отправьте новый код.";
  }

  if (message === "Email is already verified") {
    return "Почта уже подтверждена. Войдите с логином и паролем.";
  }

  if (message.startsWith("Email verification code resend is temporarily unavailable")) {
    const retryAfterSeconds = getRetryAfterSeconds(message);

    return retryAfterSeconds
      ? `Новый код можно отправить через ${formatRetryAfter(retryAfterSeconds)}.`
      : "Новый код пока нельзя отправить. Попробуйте позже.";
  }

  if (message.startsWith("Email verification code hourly limit exceeded")) {
    return "Слишком много писем с кодом. Попробуйте позже.";
  }

  if (message.startsWith("Email verification code IP hourly limit exceeded")) {
    return "Слишком много запросов на отправку кода. Попробуйте позже.";
  }

  if (message.startsWith("Too many login attempts. Try again later")) {
    const retryAfterSeconds = getRetryAfterSeconds(message);

    return retryAfterSeconds
      ? `Слишком много попыток входа. Попробуйте через ${formatRetryAfter(retryAfterSeconds)}.`
      : "Слишком много попыток входа. Попробуйте позже.";
  }

  if (message === "User already exists") {
    return "Пользователь с таким логином уже есть";
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
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];

  if (minutes > 0) {
    parts.push(`${minutes} ${decline(minutes, "минуту", "минуты", "минут")}`);
  }

  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds} ${decline(seconds, "секунду", "секунды", "секунд")}`);
  }

  return parts.join(" ");
}
