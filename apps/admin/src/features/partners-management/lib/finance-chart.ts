import type { AffiliatePartnerAnalytics } from "@/entities/affiliate-partners";

export function getFinanceChartModel(
  daily: AffiliatePartnerAnalytics["daily"],
  width: number,
  height: number,
  inset: number,
) {
  const extent = Math.max(1, ...daily.map((day) => Math.abs(day.netKopecks)));
  const points = daily
    .map((day, index) => {
      const x =
        daily.length === 1
          ? width / 2
          : inset + (index / (daily.length - 1)) * (width - inset * 2);
      const y = height / 2 - (day.netKopecks / extent) * (height / 2 - inset);
      return `${x},${y}`;
    })
    .join(" ");

  return {
    extent,
    firstDate: daily.at(0)?.date ?? null,
    lastDate: daily.at(-1)?.date ?? null,
    points,
  };
}
