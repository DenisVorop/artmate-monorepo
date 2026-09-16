const rubleFormatter = new Intl.NumberFormat("ru-RU", {
  currency: "RUB",
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
  style: "currency",
});

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});

export function formatKopecks(kopecks: number) {
  return rubleFormatter.format(kopecks / 100);
}

export function formatDate(isoDate: string) {
  return dateFormatter.format(new Date(isoDate)).replace(" г.", "");
}
