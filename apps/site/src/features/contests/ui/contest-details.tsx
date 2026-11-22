"use client";

import Image from "next/image";
import { withAuth } from "@/features/auth";

import { routes } from "@/shared/constants";
import {
  Button,
  Card,
  CardContent,
  CtaGradientButton,
  DataState,
  PageHero,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/ui";
import { Link } from "@/shared/ui/link";

import { toContestEntryInput, type ContestEntryValues } from "../lib/entry-form";
import { useContest, useMyContestEntry, useMyContestPhoto } from "@/entities/contest";
import { useContestDetailsState } from "../lib/contest-state";
import { formatContestDate } from "../lib/format-date";
import { ContestStatus } from "./contest-status";
import { ContestSurface } from "./contest-surface";
import { EntryDialog } from "./entry-dialog";
import { WorkPreview } from "./work-preview";
import { EntrySummary } from "./entry-summary";
import { useSubmitContestEntry } from "../model/use-submit-contest-entry";
import { ContestResults } from "./results";
import { useTrackContestView } from "../lib/use-track-contest-view";
import { useTrackContestEntryStart } from "../lib/use-track-contest-entry-start";

function BaseContestDetails({ slug }: { slug: string }) {
  const { contest, isPending, isError } = useContest(slug);
  const {
    entryTriggerRef,
    workTriggerRef,
    openEntry,
    openWork,
    entryOpen,
    isEntryAccessPending,
    setEntryOpen,
    selectedWork,
    setSelectedWork,
    tab,
    setTab,
    userId,
    entrySubmitted,
  } = useContestDetailsState(contest?.stage === "open");

  const {
    entry,
    isPending: isEntryPending,
    isError: isEntryError,
    refetch: refetchEntry,
  } = useMyContestEntry(slug, userId);
  const {
    photoUrl,
    isError: isPhotoError,
    refetch: refetchPhoto,
  } = useMyContestPhoto(userId, entry?.id, entry?.revisionId);
  const loadedSlug = !isPending && !isError ? contest?.slug : undefined;
  useTrackContestView(loadedSlug);
  useTrackContestEntryStart(
    loadedSlug,
    entryOpen && !isEntryPending && !isEntryError && Boolean(userId) && !entry,
  );
  const { mutate: submit, isPending: isSubmitting } = useSubmitContestEntry(
    slug,
    userId,
    entrySubmitted,
  );
  async function submitEntry(values: ContestEntryValues) {
    if (!userId) throw new Error("Войдите в аккаунт и отправьте работу ещё раз");
    await submit(toContestEntryInput(values, entry?.version));
  }

  if (isPending) return <p role="status">Загружаем конкурс…</p>;
  if (isError || !contest)
    return (
      <DataState
        variant="error"
        title="Не удалось загрузить конкурс"
        description="Обновите страницу и попробуйте ещё раз."
      />
    );

  return (
    <div className="space-y-9 md:space-y-12">
      <ContestSurface appearance={contest.appearance}>
        <div className="relative z-30 grid items-start gap-6 p-6 sm:p-8 md:gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-x-10">
          <PageHero
            breadcrumbs={[
              { label: "Главная", href: routes.home },
              { label: "Конкурсы", href: routes.contests },
              { label: contest.title },
            ]}
            title={contest.title}
            description={contest.description}
            actions={<ContestStatus stage={contest.stage} />}
          />
          <div className="space-y-7">
            <div className="space-y-3">
              <h2 className="font-heading text-2xl font-bold">Задание</h2>
              <p className="max-w-3xl text-base leading-8 text-stone-700 sm:text-lg">
                {contest.task}
              </p>
            </div>
            <dl className="grid gap-5 border-t border-stone-200 pt-6 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-stone-500">Приём работ до</dt>
                <dd className="mt-2 text-base font-bold sm:text-lg">
                  {formatContestDate(contest.closesAt, true)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-stone-500">Выбор победителей</dt>
                <dd className="mt-2 text-base font-bold sm:text-lg">
                  {formatContestDate(contest.drawAt, true)}
                </dd>
                <p className="mt-1 text-sm text-stone-500">
                  {contest.selectionMode === "AUTOMATIC"
                    ? "Случайно, по расписанию"
                    : "Выбирает Artmate"}
                </p>
              </div>
            </dl>
            {contest.stage === "upcoming" && (
              <p className="text-base text-stone-600">
                Приём работ начнётся {formatContestDate(contest.opensAt)}.
              </p>
            )}
          </div>
          <Card className="gap-0 self-start rounded-2xl py-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <CardContent className="space-y-5 p-6">
              <p className="text-sm text-stone-500">
                {contest.winnersCount === 1 ? "Приз победителю" : "Призы победителям"}
              </p>
              <h2 className="font-heading text-2xl leading-snug font-bold">{contest.prize}</h2>
              <p className="text-base leading-7 text-stone-600">{contest.prizeDetail}</p>
              {contest.stage === "open" && (
                <div className="border-t border-stone-200 pt-5">
                  <CtaGradientButton
                    type="button"
                    ref={(element) => {
                      if (element && !entryTriggerRef.current) entryTriggerRef.current = element;
                    }}
                    size="lg"
                    disabled={isEntryAccessPending || isEntryPending}
                    className="min-h-12 w-full"
                    onClick={(event) => {
                      if (entry || isEntryError) setTab("mine");
                      else openEntry(event.currentTarget);
                    }}
                  >
                    {entry ? "Моя заявка" : "Принять участие"}
                  </CtaGradientButton>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </ContestSurface>

      <ContestResults contest={contest} onOpenWork={openWork} />

      <Tabs value={tab} onValueChange={setTab} className="gap-7">
        <TabsList
          variant="line"
          className="h-auto! w-full justify-start gap-3 border-b border-stone-200 pb-2 sm:gap-6"
          aria-label="Разделы конкурса"
        >
          <TabsTrigger value="works" className="min-h-11 px-1 text-sm sm:text-base">
            Работы <span className="ml-1 text-stone-400">{contest.works.length}</span>
          </TabsTrigger>
          <TabsTrigger value="rules" className="min-h-11 px-1 text-sm sm:text-base">
            Условия
          </TabsTrigger>
          <TabsTrigger value="mine" className="min-h-11 px-1 text-sm sm:text-base">
            Моя заявка
          </TabsTrigger>
        </TabsList>
        <TabsContent value="works" className="m-0">
          {contest.works.length ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-4">
              {contest.works.map((work) => (
                <article key={work.id} id={`work-${work.id}`} className="min-w-0 space-y-3">
                  <Button
                    type="button"
                    variant="ghost"
                    className="relative block aspect-[4/5] h-auto! w-full overflow-hidden rounded-2xl bg-stone-200/50 p-0 hover:bg-stone-200/70"
                    onClick={(event) => openWork(work, event.currentTarget)}
                    aria-label={`Открыть работу: ${work.title}`}
                  >
                    <Image
                      src={work.image}
                      alt={work.title}
                      fill
                      unoptimized
                      sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                      className="object-contain"
                    />
                  </Button>
                  <div className="space-y-1 px-0.5">
                    <h3 className="truncate text-sm font-bold sm:text-base" title={work.author}>
                      {work.author}
                    </h3>
                    <p className="text-sm text-stone-500">
                      {work.albumTitle}
                      {work.number ? ` · № ${work.number}` : ""}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="space-y-4 py-8 text-center sm:py-12">
              <h2 className="font-heading text-xl font-bold">Работ пока нет</h2>
              {contest.stage === "upcoming" && (
                <p className="text-base text-stone-600">
                  Приём работ начнётся {formatContestDate(contest.opensAt)}.
                </p>
              )}
              <Button asChild variant="outline" size="lg" className="min-h-12">
                <Link href={routes.catalogColorings}>Посмотреть альбомы</Link>
              </Button>
            </div>
          )}
        </TabsContent>
        <TabsContent value="rules" className="m-0 max-w-3xl space-y-6">
          <h2 className="font-heading text-2xl font-bold">Условия участия</h2>
          <div className="flex flex-wrap gap-4 text-sm">
            <Link
              href={routes.legal.contestRules}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4"
            >
              Правила конкурсов Artmate
            </Link>
            {contest.legalDocumentId && (
              <Link
                href={routes.legal.contestConditions(contest.slug, contest.legalDocumentId)}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-4"
              >
                Полные условия конкурса
              </Link>
            )}
          </div>
          <ul className="list-disc space-y-3 pl-5 text-base leading-7 text-stone-700">
            {contest.rules.map((rule) => (
              <li key={rule} className="pl-1">
                {rule}
              </li>
            ))}
          </ul>
        </TabsContent>
        <TabsContent value="mine" className="m-0">
          {isEntryPending ? (
            <p role="status">Загружаем заявку…</p>
          ) : isEntryError ? (
            <div className="space-y-4">
              <p>Не удалось загрузить вашу заявку</p>
              <Button variant="outline" onClick={() => void refetchEntry()}>
                Повторить
              </Button>
            </div>
          ) : entry ? (
            <EntrySummary
              entry={entry}
              photoUrl={photoUrl}
              isPhotoError={isPhotoError}
              onRetryPhoto={() => void refetchPhoto()}
              onEdit={openEntry}
            />
          ) : (
            <div className="max-w-2xl space-y-4 py-5">
              <h2 className="font-heading text-2xl font-bold">
                {contest.stage === "completed" || contest.stage === "review"
                  ? "Вы не участвовали в этом конкурсе"
                  : "Вы ещё не добавили работу"}
              </h2>
              {contest.stage === "open" && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isEntryAccessPending || isEntryPending}
                  size="lg"
                  className="min-h-12"
                  onClick={(event) => openEntry(event.currentTarget)}
                >
                  Принять участие
                </Button>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
      {!isEntryPending && !isEntryError && userId && (!entry || entry.canEdit) && (
        <EntryDialog
          key={`${userId}:${entry?.version ?? "new"}`}
          returnFocusRef={entryTriggerRef}
          open={entryOpen}
          onOpenChange={(open) => {
            if (!isSubmitting) setEntryOpen(open);
          }}
          contestTitle={contest.title}
          slug={contest.slug}
          initialValues={
            entry
              ? {
                  albumId: entry.albumId,
                  number: entry.number ? String(entry.number) : "",
                  caption: entry.caption,
                }
              : undefined
          }
          existingPhoto={photoUrl}
          hasExistingPhoto={Boolean(entry)}
          isPending={isSubmitting}
          onSubmit={submitEntry}
        />
      )}
      <WorkPreview
        returnFocusRef={workTriggerRef}
        work={selectedWork}
        onClose={() => setSelectedWork(undefined)}
      />
    </div>
  );
}

export const ContestDetails = withAuth(BaseContestDetails, { source: "contest_entry" });
