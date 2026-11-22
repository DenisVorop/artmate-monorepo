"use client";

import { routes } from "@/shared/constants";
import { cn } from "@/shared/lib";
import { DataState, PageHero, Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui";
import { Link } from "@/shared/ui/link";
import { SectionTitle } from "@/shared/ui/typography";

import { useContests } from "@/entities/contest";
import { useContestListState } from "../lib/contest-state";
import { formatContestDate, formatContestPeriod } from "../lib/format-date";
import { ContestStatus } from "./contest-status";
import { ContestFeatured } from "./contest-featured";

const filters = [
  { value: "all", label: "Все" },
  { value: "open", label: "Приём работ" },
  { value: "upcoming", label: "Скоро" },
  { value: "review", label: "Приём завершён" },
  { value: "completed", label: "Итоги" },
] as const;

export function ContestList() {
  const { filter, setFilter } = useContestListState();
  const { contests: allContests, isError, isPending } = useContests();
  const featured =
    allContests.find((contest) => contest.stage === "open") ??
    allContests.find((contest) => contest.stage === "upcoming");
  const contests = allContests.filter((contest) => filter === "all" || contest.stage === filter);

  return (
    <div className="space-y-10 md:space-y-14">
      <PageHero
        breadcrumbs={[{ label: "Главная", href: routes.home }, { label: "Конкурсы" }]}
        title="Конкурсы Artmate"
      />

      {isPending ? (
        <p role="status">Загружаем конкурсы…</p>
      ) : isError ? (
        <DataState
          variant="error"
          title="Не удалось загрузить конкурсы"
          description="Обновите страницу и попробуйте ещё раз."
        />
      ) : !allContests.length ? (
        <p className="text-stone-600">Новые конкурсы появятся здесь.</p>
      ) : null}
      {featured && <ContestFeatured contest={featured} />}
      {!isPending && !isError && allContests.length > 0 && (
        <section aria-labelledby="contest-list-title" className="space-y-6">
          <SectionTitle id="contest-list-title">Все конкурсы</SectionTitle>
          <Tabs
            value={filter}
            onValueChange={(value) => setFilter(value as typeof filter)}
            className="gap-5"
          >
            <TabsList
              className="h-auto! max-w-full flex-wrap justify-start gap-1 rounded-xl bg-white p-1 ring-1 ring-stone-200"
              aria-label="Статус конкурса"
            >
              {filters.map((item) => (
                <TabsTrigger
                  key={item.value}
                  value={item.value}
                  className="min-h-11 rounded-lg px-3 text-sm hover:bg-stone-50 sm:px-5 data-active:bg-stone-900 data-active:text-white"
                >
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value={filter} className="m-0">
              <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200">
                <div
                  aria-hidden="true"
                  className="hidden grid-cols-[minmax(0,1.5fr)_1fr_1fr_1.3fr] gap-5 border-b border-stone-200 bg-stone-50 px-6 py-3 text-sm text-stone-500 lg:grid"
                >
                  <span>Конкурс</span>
                  <span>Приём работ</span>
                  <span>Итоги</span>
                  <span>Призы</span>
                </div>
                {!contests.length && (
                  <p className="px-6 py-8 text-stone-600">Таких конкурсов пока нет</p>
                )}
                <ul className="divide-y divide-stone-200">
                  {contests.map((contest) => (
                    <li key={contest.slug}>
                      <Link
                        href={routes.contest(contest.slug)}
                        className={cn(
                          "grid grid-cols-2 gap-4 px-5 py-6 hover:bg-orange-50/70 focus-visible:ring-3 focus-visible:ring-rose-400 focus-visible:ring-inset lg:grid-cols-[minmax(0,1.5fr)_1fr_1fr_1.3fr] lg:items-center lg:gap-5 lg:px-6",
                          contest.stage === "open" && "bg-orange-50/50",
                        )}
                      >
                        <div className="col-span-2 space-y-2 lg:col-span-1">
                          <h3 className="font-heading text-lg font-bold">{contest.title}</h3>
                          <ContestStatus stage={contest.stage} />
                        </div>
                        <div className="space-y-1 text-sm sm:text-base">
                          <p className="text-xs text-stone-500 lg:hidden">Приём работ</p>
                          <p>{formatContestPeriod(contest.opensAt, contest.closesAt)}</p>
                        </div>
                        <div className="space-y-1 text-sm sm:text-base">
                          <p className="text-xs text-stone-500 lg:hidden">Итоги</p>
                          <p>{formatContestDate(contest.drawAt)}</p>
                        </div>
                        <p className="col-span-2 text-sm leading-6 text-stone-600 lg:col-span-1">
                          {contest.prize}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </TabsContent>
          </Tabs>
        </section>
      )}
    </div>
  );
}
