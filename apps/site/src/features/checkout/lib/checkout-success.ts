export function getOrderLoadErrorMessage(error: Error | null) {
  const message = error?.message ?? "";

  if (
    message === "Authentication required" ||
    message.toLowerCase().includes("unauthorized") ||
    message.toLowerCase().includes("forbidden")
  ) {
    return "Заказ доступен только в аккаунте, с которого он был оформлен. Войдите в нужный аккаунт или свяжитесь с нами.";
  }

  return "Проверьте ссылку или попробуйте позже.";
}
