import type { DeliveryDateRangeDTO } from "@/shared/actions/orders";

type DateParts = {
  year: number;
  month: number;
  day: number;
};

const genitiveMonthNames = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
] as const;

export function formatEstimatedDeliveryDateRange(
  range: DeliveryDateRangeDTO | undefined,
) {
  if (!range) {
    return undefined;
  }

  const min = parseDate(range.min);
  const max = parseDate(range.max);

  if (!min || !max) {
    return undefined;
  }

  if (min.year === max.year && min.month === max.month) {
    return min.day === max.day
      ? formatDate(min)
      : `${min.day}-${max.day} ${formatMonth(max)}`;
  }

  if (min.year === max.year) {
    return `${formatDate(min)} - ${formatDate(max)}`;
  }

  return `${formatDateWithYear(min)} - ${formatDateWithYear(max)}`;
}

function parseDate(value: string): DateParts | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return undefined;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (!year || !month || !day || month < 1 || month > 12 || day < 1 || day > 31) {
    return undefined;
  }

  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }

  return { day, month, year };
}

function formatDate(parts: DateParts) {
  return `${parts.day} ${formatMonth(parts)}`;
}

function formatDateWithYear(parts: DateParts) {
  return `${formatDate(parts)} ${parts.year}`;
}

function formatMonth(parts: DateParts) {
  return genitiveMonthNames[parts.month - 1];
}
