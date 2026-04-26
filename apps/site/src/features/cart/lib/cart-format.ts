export function formatMoney(value: number) {
  return `${value.toLocaleString("ru-RU")} ₽`;
}

export function getItemsWord(count: number) {
  const lastTwoDigits = Math.abs(count) % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return "товаров";
  }

  const lastDigit = Math.abs(count) % 10;

  if (lastDigit === 1) {
    return "товар";
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return "товара";
  }

  return "товаров";
}
