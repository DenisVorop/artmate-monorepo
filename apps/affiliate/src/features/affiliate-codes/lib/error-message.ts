export function getAffiliateCodeErrorMessage(status: number, code?: string) {
  if (code === "affiliate_code_limit") {
    return "У вас уже максимальное количество промокодов. Новый код создать нельзя.";
  }

  if (status === 409) {
    return "Такой промокод уже существует. Попробуйте другой.";
  }

  if (status === 400) {
    return "Проверьте код, комментарий и распределение процентов.";
  }

  return "Не удалось сохранить промокод. Попробуйте ещё раз.";
}
