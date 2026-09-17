export function getPayoutErrorMessage(status: number, code?: string) {
  switch (code) {
    case "affiliate_payout_open_request":
      return "У вас уже есть заявка на рассмотрении.";
    case "affiliate_payout_below_minimum":
      return "Сумма меньше действующего минимума. Обновите данные и попробуйте снова.";
    case "affiliate_payout_unavailable_balance":
      return "Доступный остаток изменился. Обновите данные и проверьте сумму.";
    case "affiliate_payout_request_conflict":
      return "Не удалось безопасно повторить заявку. Обновите историю выплат.";
  }

  if (status === 401) {
    return "Сессия завершилась. Войдите снова, затем проверьте историю выплат.";
  }

  if (status === 403) {
    return "Доступ к выплатам сейчас ограничен. Обновите данные или обратитесь в поддержку.";
  }

  return status >= 500
    ? "Ответ не получен. Повторите отправку: сумма и номер заявки сохранятся."
    : "Не удалось отправить заявку. Проверьте данные и попробуйте снова.";
}
