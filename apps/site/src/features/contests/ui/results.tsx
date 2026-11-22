import Image from "next/image";
import type { Contest, ContestWork } from "@/entities/contest";
import { Button, Card } from "@/shared/ui";
import { SectionTitle } from "@/shared/ui/typography";
import { formatContestDate } from "../lib/format-date";

export function ContestResults({
  contest,
  onOpenWork,
}: {
  contest: Contest;
  onOpenWork: (_work: ContestWork, _trigger: HTMLButtonElement) => void;
}) {
  if (!contest.draw) {
    if (contest.stage !== "review") return null;
    return (
      <section aria-labelledby="contest-results" className="space-y-3">
        <SectionTitle id="contest-results">Итоги</SectionTitle>
        <p className="text-stone-600">
          {contest.resultsPendingModeration
            ? "Проверяем последние работы. Итоги появятся после проверки."
            : Date.now() < new Date(contest.drawAt).getTime()
              ? `Подведём итоги ${formatContestDate(contest.drawAt, true)}.`
              : contest.selectionMode === "MANUAL"
                ? "Победителей выбирает Artmate. Скоро опубликуем результаты."
                : "Подводим итоги."}
        </p>
      </section>
    );
  }
  const result = contest.draw;
  return (
    <section aria-labelledby="contest-winners" className="space-y-5">
      <div className="space-y-2">
        <SectionTitle id="contest-winners">
          {result.winners.length ? "Победители" : "Итоги"}
        </SectionTitle>
        <p className="text-sm text-stone-500">
          {result.mode === "AUTOMATIC" ? "Случайный выбор" : "Выбор Artmate"} ·{" "}
          {formatContestDate(result.drawnAt, true)}
        </p>
      </div>
      {!result.winners.length && (
        <p className="text-stone-600">Допущенных работ нет. Конкурс завершён без победителей.</p>
      )}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {result.winners.map(({ id, work }) => (
          <li key={id}>
            <Card className="h-full gap-4 overflow-hidden p-4">
              {work ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    className="relative aspect-[4/3] h-auto! w-full overflow-hidden rounded-xl bg-stone-100 p-0"
                    onClick={(event) => onOpenWork(work, event.currentTarget)}
                    aria-label={`Посмотреть работу: ${work.author}`}
                  >
                    <Image
                      src={work.image}
                      alt={work.title}
                      fill
                      unoptimized
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      className="object-contain"
                    />
                  </Button>
                  <div className="space-y-1">
                    <h3 className="font-heading text-lg font-bold break-words">{work.author}</h3>
                    <p className="text-sm text-stone-500">{work.albumTitle}</p>
                  </div>
                  <p className="text-sm text-stone-600">{contest.prize}</p>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-auto min-h-11"
                    onClick={(event) => onOpenWork(work, event.currentTarget)}
                  >
                    Посмотреть работу
                  </Button>
                </>
              ) : (
                <p className="text-stone-600">Работа скрыта</p>
              )}
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
