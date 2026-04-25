export function getAuthErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Не удалось выполнить запрос";

  if (message === "Invalid login or password") {
    return "Неверный логин или пароль";
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
