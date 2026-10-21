export class FlowError extends Error {
  public readonly status: number;

  private constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }

  public static from(
    error: unknown,
    action: "password" | "confirm" | "link" | "recovery" | "other",
  ): FlowError {
    const status =
      error && typeof error === "object" && "status" in error && typeof error.status === "number"
        ? error.status
        : 500;
    let message = "Не удалось продолжить вход. Попробуйте позже.";
    if (status === 429) message = "Слишком много попыток. Попробуйте позже.";
    else if (status === 401)
      message =
        action === "password" ? "Проверьте почту и пароль." : "Время истекло. Войдите заново.";
    else if (status === 400 && action === "link") message = "Ссылка не действует. Запросите новую.";
    else if (status === 400)
      message =
        action === "confirm"
          ? "Код не подошёл. Проверьте или запросите новый."
          : "Проверьте введённые данные.";
    else if (status === 409) message = "Данные изменились. Начните вход заново.";
    return new FlowError(status, message);
  }
}
