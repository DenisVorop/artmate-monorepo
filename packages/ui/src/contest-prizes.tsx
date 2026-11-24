import { Trophy } from "lucide-react";

export type ContestPrizePresentation = {
  mode: "equal" | "places";
  winners: {
    place?: number;
    winnersCount?: number;
    title: string;
    detail?: string;
  }[];
  participation?: { title: string; detail?: string };
};

export type ContestAward =
  | { kind: "place"; place: number }
  | { kind: "participation" };

export function contestAwardLabel(award?: ContestAward) {
  if (!award) return null;
  return award.kind === "participation"
    ? "За участие"
    : `${award.place}-е место`;
}

export function ContestPlaceIcon({
  place,
  className = "size-8 shrink-0",
}: {
  place: number;
  className?: string;
}) {
  const color =
    place === 1
      ? "#b88a20"
      : place === 2
        ? "#8793a3"
        : place === 3
          ? "#ad6d43"
          : "#78716c";
  return (
    <Trophy
      aria-hidden="true"
      className={className}
      style={{ color }}
      fill="currentColor"
      fillOpacity={0.12}
      strokeWidth={1.75}
    />
  );
}

const winnerCountPluralRules = new Intl.PluralRules("ru");

function formatWinnerCount(count: number) {
  const form = winnerCountPluralRules.select(count);
  if (form === "one") return `${count} победитель`;
  if (form === "few") return `${count} победителя`;
  return `${count} победителей`;
}

export function ContestPrizeList({
  prizes,
}: {
  prizes: ContestPrizePresentation;
}) {
  const winners =
    prizes.mode === "places"
      ? [...prizes.winners].sort(
          (a, b) => (a.place ?? Infinity) - (b.place ?? Infinity),
        )
      : prizes.winners;
  const showWinnerCounts =
    prizes.mode === "places" &&
    winners.some(({ winnersCount = 1 }) => winnersCount > 1);
  return (
    <div className="space-y-3">
      <ol className="divide-y divide-stone-200/80">
        {winners.map((prize, index) => (
          <li
            key={prize.place ?? index}
            className="flex items-start gap-2.5 py-2.5 first:pt-0 last:pb-0"
          >
            {prizes.mode === "places" && prize.place !== undefined && (
              <ContestPlaceIcon
                place={prize.place}
                className="mt-0.5 size-6 shrink-0"
              />
            )}
            <div className="min-w-0 space-y-0.5">
              {prizes.mode === "places" && prize.place !== undefined && (
                <p className="text-xs font-medium text-stone-500">
                  {prize.place}-е место
                  {showWinnerCounts &&
                    ` · ${formatWinnerCount(prize.winnersCount ?? 1)}`}
                </p>
              )}
              <p
                style={{
                  fontFamily: "var(--font-comfortaa, var(--font-heading))",
                }}
                className="font-heading text-base leading-snug font-bold text-stone-900"
              >
                {prize.title}
              </p>
              {prize.detail && (
                <p className="text-sm leading-5 text-stone-600">
                  {prize.detail}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
      {prizes.participation && (
        <div className="space-y-0.5 border-t border-dashed border-stone-300 pt-3">
          <p className="text-xs font-medium text-stone-500">За участие</p>
          <p
            style={{ fontFamily: "var(--font-comfortaa, var(--font-heading))" }}
            className="font-heading text-base leading-snug font-bold text-stone-900"
          >
            {prizes.participation.title}
          </p>
          {prizes.participation.detail && (
            <p className="text-sm leading-5 text-stone-600">
              {prizes.participation.detail}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
