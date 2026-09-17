const analyticsDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const integerFormatter = new Intl.NumberFormat("ru-RU");

export function formatFinanceKopecks(kopecks: number) {
  if (!Number.isSafeInteger(kopecks)) {
    throw new RangeError("Kopecks must be a safe integer");
  }

  const absoluteKopecks = Math.abs(kopecks);
  const rubles = Math.floor(absoluteKopecks / 100);
  const remainder = absoluteKopecks % 100;
  const fraction =
    remainder === 0
      ? ""
      : `,${remainder % 10 === 0 ? remainder / 10 : String(remainder).padStart(2, "0")}`;

  return `${kopecks < 0 ? "-" : ""}${integerFormatter.format(rubles)}${fraction}\u00a0₽`;
}

export function formatSignedFinanceKopecks(kopecks: number) {
  const prefix = kopecks > 0 ? "+" : "";
  return `${prefix}${formatFinanceKopecks(kopecks)}`;
}

export function formatOrderCount(count: number) {
  return integerFormatter.format(count);
}

export function formatAnalyticsDate(date: string) {
  return analyticsDateFormatter.format(new Date(`${date}T00:00:00.000Z`));
}
