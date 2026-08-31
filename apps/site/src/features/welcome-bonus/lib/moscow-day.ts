const moscowDayFormatter = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Europe/Moscow",
  year: "numeric",
});

const searchWindowMs = 36 * 60 * 60 * 1000;

export function getMoscowDayKey(now: number) {
  const parts = moscowDayFormatter.formatToParts(new Date(now));
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Failed to resolve Europe/Moscow calendar date");
  }

  return `${year}-${month}-${day}`;
}

export function getMsUntilNextMoscowDay(now: number) {
  const currentDay = getMoscowDayKey(now);
  let low = now + 1;
  let high = now + searchWindowMs;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (getMoscowDayKey(middle) === currentDay) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return low - now;
}
