export function albumQuantity(quantity: number) {
  const mod100 = quantity % 100,
    mod10 = quantity % 10;
  return `${quantity} ${mod10 === 1 && mod100 !== 11 ? "альбом" : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? "альбома" : "альбомов"}`;
}
export function prizeTitle(quantity: number) {
  return `${quantity === 1 ? "Альбом" : quantity === 2 ? "Два альбома" : albumQuantity(quantity)} на выбор`;
}
export function prizeDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    timeZone: "Europe/Moscow",
  }).format(new Date(value));
}
