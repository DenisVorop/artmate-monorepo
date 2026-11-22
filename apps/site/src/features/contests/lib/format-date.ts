const dateOptions = { day: "numeric", month: "long", timeZone: "Europe/Moscow" } as const;

export function formatContestDate(value: string, withTime = false) {
  return new Intl.DateTimeFormat("ru-RU", {
    ...dateOptions,
    ...(withTime ? ({ hour: "2-digit", minute: "2-digit" } as const) : {}),
  }).format(new Date(value));
}

export function formatContestPeriod(start: string, end: string) {
  return new Intl.DateTimeFormat("ru-RU", dateOptions).formatRange(new Date(start), new Date(end));
}
