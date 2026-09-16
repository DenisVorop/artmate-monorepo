export function getAffiliateCodeErrorMessage(status: number) {
  if (status === 409) {
    return "Такой промокод уже существует. Попробуйте другой.";
  }

  if (status === 400) {
    return "Проверьте код, комментарий и распределение процентов.";
  }

  return "Не удалось сохранить промокод. Попробуйте ещё раз.";
}
