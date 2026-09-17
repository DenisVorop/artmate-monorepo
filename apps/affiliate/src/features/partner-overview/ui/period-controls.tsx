import type { AffiliateAnalyticsDays } from "@/entities/affiliate-finance";
import { cn } from "@/shared/lib";

const periods = [
  { days: 7, label: "7 дней" },
  { days: 30, label: "30 дней" },
  { days: 90, label: "90 дней" },
] as const;

type PeriodControlsProps = {
  readonly days: AffiliateAnalyticsDays;
  readonly onChange: (days: AffiliateAnalyticsDays) => void;
};

export function PeriodControls({ days, onChange }: PeriodControlsProps) {
  return (
    <div
      className="inline-grid grid-cols-3 rounded-2xl bg-white p-1 ring-1 ring-foreground/8"
      aria-label="Период аналитики"
      role="group"
    >
      {periods.map((period) => (
        <button
          aria-pressed={days === period.days}
          className={cn(
            "rounded-xl px-3 py-2 text-xs font-extrabold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 sm:px-5 sm:text-sm",
            days === period.days
              ? "bg-ink text-white shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-ink",
          )}
          key={period.days}
          onClick={() => onChange(period.days)}
          type="button"
        >
          {period.label}
        </button>
      ))}
    </div>
  );
}
