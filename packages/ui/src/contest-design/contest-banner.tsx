import type { ReactNode } from "react";
import { contestAppearances, type ContestAppearance } from "./appearance";
import { cn } from "./class-names";
import { ContestSurface, type ContestCard } from "./contest-surface";

export const contestBannerActionClasses = {
  primary:
    "min-h-12 border-0 bg-gradient-to-r from-rose-500 via-rose-400 to-orange-400 px-5 text-white",
  secondary: "min-h-12 bg-white/80 px-5",
};
export const contestStagePresentation = {
  open: { label: "Приём работ", className: "bg-emerald-50 text-emerald-800" },
  upcoming: { label: "Скоро", className: "bg-amber-50 text-amber-900" },
  review: { label: "Приём завершён", className: "bg-stone-100 text-stone-600" },
  completed: { label: "Итоги", className: "bg-stone-100 text-stone-600" },
} as const;
export const contestStatusClassName =
  "h-auto rounded-md border-0 px-2.5 py-1 text-sm font-semibold";
export type ContestBannerContent = {
  appearance: ContestAppearance;
  title: string;
  description: string;
  prize: string;
  winnersCount: number;
  selectionMode: "AUTOMATIC" | "MANUAL";
  closesAt?: string;
  drawAt?: string;
};
const dateOptions = {
  day: "numeric",
  month: "long",
  timeZone: "Europe/Moscow",
} as const;
function date(value?: string) {
  const parsed = value ? new Date(value) : undefined;
  return parsed && Number.isFinite(parsed.getTime()) ? parsed : undefined;
}

export function ContestBanner({
  contest,
  card,
  status,
  actions,
}: {
  contest: ContestBannerContent;
  card: ContestCard;
  status: ReactNode;
  actions: ReactNode;
}) {
  const preset = contestAppearances[contest.appearance],
    deadline = date(contest.closesAt),
    draw = date(contest.drawAt);
  const parts = deadline
    ? new Intl.DateTimeFormat("ru-RU", dateOptions).formatToParts(deadline)
    : [];
  return (
    <div
      data-contest-banner=""
      className="@container/contest font-[family-name:var(--font-nunito)] text-stone-900"
    >
      <ContestSurface
        card={card}
        appearance={contest.appearance}
        className="@min-[768px]/contest:grid @min-[768px]/contest:grid-cols-[10rem_minmax(0,1fr)] @min-[1024px]/contest:grid-cols-[11rem_minmax(0,1fr)]"
      >
        <div
          className={cn(
            "px-6 py-4 @min-[768px]/contest:flex @min-[768px]/contest:flex-col @min-[768px]/contest:py-6 @min-[1024px]/contest:px-8",
            preset.date,
          )}
        >
          <time
            dateTime={deadline ? contest.closesAt : undefined}
            aria-label={
              deadline
                ? `До ${new Intl.DateTimeFormat("ru-RU", dateOptions).format(deadline)}`
                : undefined
            }
            className="relative z-30 flex items-baseline gap-3 font-[family-name:var(--font-comfortaa)] @min-[768px]/contest:flex-1 @min-[768px]/contest:flex-col @min-[768px]/contest:items-start @min-[768px]/contest:justify-between @min-[768px]/contest:gap-1"
          >
            <span className="text-lg">До</span>
            <strong
              className={cn(
                "text-5xl leading-none font-medium tracking-tight @min-[768px]/contest:my-1 @min-[768px]/contest:text-8xl",
                preset.number,
              )}
            >
              {parts.find((part) => part.type === "day")?.value ?? "—"}
            </strong>
            <span className="text-lg">
              {parts.find((part) => part.type === "month")?.value}
            </span>
          </time>
        </div>
        <div className="relative z-30 grid items-center gap-5 p-6 @min-[1024px]/contest:grid-cols-[minmax(0,1fr)_22rem] @min-[1024px]/contest:gap-8 @min-[1024px]/contest:p-8">
          <div className="space-y-4">
            <div className="space-y-3">
              {status}
              <h2 className="font-[family-name:var(--font-comfortaa)] text-3xl leading-tight font-bold break-words @min-[1280px]/contest:text-4xl">
                {contest.title}
              </h2>
              <p className="max-w-xl text-base leading-7 break-words text-stone-600">
                {contest.description}
              </p>
            </div>
            {draw && (
              <p className="text-sm leading-6 text-stone-500">
                Итоги —{" "}
                {new Intl.DateTimeFormat("ru-RU", dateOptions).format(draw)}.
                {contest.selectionMode === "AUTOMATIC"
                  ? " Победителей выбираем случайно."
                  : " Победителей выбирает Artmate."}
              </p>
            )}
          </div>
          <div className="space-y-5 border-t border-stone-200/70 pt-5 @min-[1024px]/contest:border-t-0 @min-[1024px]/contest:pt-0">
            <div className="space-y-1.5">
              <p className="text-sm text-stone-500">
                {contest.winnersCount === 1
                  ? "Приз победителю"
                  : `Призы для ${contest.winnersCount} победителей`}
              </p>
              <p className="font-[family-name:var(--font-comfortaa)] text-xl font-bold break-words">
                {contest.prize}
              </p>
            </div>
            <div className="flex flex-col gap-3 @min-[640px]/contest:flex-row @min-[640px]/contest:flex-wrap">
              {actions}
            </div>
          </div>
        </div>
      </ContestSurface>
    </div>
  );
}
