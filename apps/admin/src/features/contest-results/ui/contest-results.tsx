"use client";
import Image from "next/image";
import { ContestPlaceIcon } from "@repo/ui/contest-prizes";
import Link from "next/link";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useContestDraw, type ContestDrawData } from "@/entities/contest-draw";
import { routes } from "@/shared/constants";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Card,
  CardContent,
  Checkbox,
  Label,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/shared/ui";
import {
  rankedSelectionGroups,
  selectionFormSchema,
  toSelectionInput,
  type SelectionFormValues,
} from "../lib/selection-form";
import { useResultsState } from "../lib/results-state";
import { formatTime } from "../lib/format-date";
import { useSelectWinners } from "../model/use-select-winners";

export function ContestResults({ contestId }: { contestId: string }) {
  const { data, isPending, isError, refetch } = useContestDraw(contestId);
  if (isPending) return <p role="status">Загружаем участников…</p>;
  if (isError || !data)
    return (
      <div className="space-y-3">
        <p>Не удалось загрузить результаты</p>
        <Button variant="outline" onClick={() => void refetch()}>
          Повторить
        </Button>
      </div>
    );
  return (
    <ResultsContent
      key={data.contest.id}
      data={data}
      onRefresh={() => void refetch()}
    />
  );
}

function ResultsContent({
  data,
  onRefresh,
}: {
  data: ContestDrawData;
  onRefresh: () => void;
}) {
  const { result, contest } = data;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">{contest.title}</h2>
          <p className="text-sm text-muted-foreground">
            {contest.selectionMode === "AUTOMATIC"
              ? "Случайный выбор по расписанию"
              : "Ручной выбор"}{" "}
            · {formatTime(contest.drawAt)} (МСК)
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href={routes.contestEntries(contest.id)}>Проверить заявки</Link>
        </Button>
      </div>
      {result ? (
        <Card>
          <CardContent className="space-y-6 pt-6">
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">Результаты опубликованы</h3>
              <p className="text-sm text-muted-foreground">
                {formatTime(result.drawnAt)} (МСК) · Допущено работ:{" "}
                {result.eligibleCount}
              </p>
              {result.actor && (
                <p className="text-sm">
                  Выбрал: {result.actor.name || "Администратор"}
                </p>
              )}
            </div>
            {!result.winners.length && (
              <p>Допущенных работ нет. Конкурс завершён без победителей.</p>
            )}
            <ul className="divide-y">
              {result.winners.map((winner) => (
                <li
                  key={winner.id}
                  className="flex flex-wrap items-center gap-4 py-4"
                >
                  {winner.work && (
                    <Image
                      src={winner.work.image}
                      alt={winner.work.title}
                      width={88}
                      height={88}
                      unoptimized
                      className="h-22 w-22 rounded-lg bg-muted object-contain"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    {winner.place !== undefined && (
                      <p className="mb-2 flex items-center gap-2 text-sm">
                        <ContestPlaceIcon
                          place={winner.place}
                          className="size-5"
                        />
                        {winner.place}-е место
                      </p>
                    )}
                    {winner.prizeTitle && (
                      <p className="text-sm text-muted-foreground">
                        {winner.prizeTitle}
                      </p>
                    )}
                    <p className="font-semibold">{winner.author}</p>
                    <p className="text-sm text-muted-foreground">
                      {winner.work?.albumTitle ?? "Работа скрыта"}
                    </p>
                  </div>
                  <Button variant="outline" asChild>
                    <Link href={routes.contestEntry(winner.entryId)}>
                      Заявка
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
            <details className="text-sm">
              <summary className="cursor-pointer font-medium">
                Протокол выбора
              </summary>
              <dl className="mt-3 space-y-2 text-muted-foreground">
                <div>
                  <dt>Алгоритм</dt>
                  <dd>{result.algorithm}</dd>
                </div>
                <div>
                  <dt>Контрольная сумма списка</dt>
                  <dd className="break-all font-mono text-xs">
                    {result.eligibilityHash}
                  </dd>
                </div>
              </dl>
            </details>
          </CardContent>
        </Card>
      ) : (
        <>
          {data.blocker && (
            <div
              role="status"
              className="space-y-2 rounded-xl border bg-muted/30 p-4"
            >
              <p>{data.blocker}</p>
              {data.pendingCount > 0 && (
                <p className="text-sm text-muted-foreground">
                  Осталось проверить: {data.pendingCount}
                </p>
              )}
            </div>
          )}
          {contest.selectionMode === "AUTOMATIC" ? (
            <Card>
              <CardContent className="space-y-3 pt-6">
                <h3 className="text-xl font-semibold">Автоматический выбор</h3>
                <p className="text-muted-foreground">
                  Допущено работ: {data.candidates.length}. Победителей:{" "}
                  {Math.min(contest.winnersCount, data.candidates.length)}.
                </p>
                <p>
                  Результаты появятся после выбора по расписанию и завершения
                  проверки заявок.
                </p>
              </CardContent>
            </Card>
          ) : (
            <SelectionForm
              key={data.rosterToken ?? "blocked"}
              data={data}
              onRefresh={onRefresh}
            />
          )}
        </>
      )}
    </div>
  );
}

function SelectionForm({
  data,
  onRefresh,
}: {
  data: ContestDrawData;
  onRefresh: () => void;
}) {
  const { confirmation, setConfirmation, publishButtonRef } = useResultsState();
  const form = useForm<SelectionFormValues>({
    resolver: zodResolver(selectionFormSchema),
    defaultValues: {
      entryIds:
        data.contest.prizeMode === "PLACES"
          ? Array(
              Math.min(data.contest.winnersCount, data.candidates.length),
            ).fill("")
          : [],
    },
  });
  const selected = useWatch({ control: form.control, name: "entryIds" });
  const { mutate: selectWinners, isPending } = useSelectWinners(
    data.contest.id,
  );
  const count = Math.min(data.contest.winnersCount, data.candidates.length);
  const groups = rankedSelectionGroups(data.contest.prizes, count);
  const places = groups.flatMap(({ place, slots }) => slots.map(() => place));
  const error = form.formState.errors.root?.message;
  async function publish() {
    if (!confirmation) return;
    try {
      await selectWinners(confirmation);
    } catch (error) {
      form.setError("root", {
        message:
          error instanceof Error
            ? error.message
            : "Не удалось опубликовать результаты",
      });
      onRefresh();
    } finally {
      setConfirmation(null);
    }
  }
  return (
    <>
      <form
        className="space-y-6"
        onSubmit={form.handleSubmit((values) => {
          form.clearErrors("root");
          try {
            setConfirmation(toSelectionInput(values, data));
          } catch (error) {
            form.setError("root", {
              message:
                error instanceof Error
                  ? error.message
                  : "Проверьте выбор победителей",
            });
          }
        })}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xl font-semibold">
            Допущенные работы · {data.candidates.length}
          </h3>
          <Button type="button" variant="outline" onClick={onRefresh}>
            Обновить список
          </Button>
        </div>
        {!data.candidates.length && <p>Допущенных работ нет.</p>}
        <fieldset disabled={isPending || Boolean(data.blocker)}>
          <legend className="sr-only">Выберите победителей</legend>
          <Controller
            control={form.control}
            name="entryIds"
            render={({ field }) =>
              data.contest.prizeMode === "PLACES" ? (
                <RankedWinnerPicker
                  groups={groups}
                  candidates={data.candidates}
                  selected={field.value}
                  onChange={field.onChange}
                />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {data.candidates.map((candidate) => {
                    const index = field.value.indexOf(candidate.entryId);
                    return (
                      <Card
                        key={candidate.entryId}
                        className={index >= 0 ? "ring-2 ring-primary" : ""}
                      >
                        <CardContent className="space-y-3 pt-4">
                          <Image
                            src={candidate.work.image}
                            alt={candidate.work.title}
                            width={320}
                            height={220}
                            unoptimized
                            className="h-48 w-full rounded-lg bg-muted object-contain"
                          />
                          <div className="flex items-start gap-3">
                            <Checkbox
                              id={`winner-${candidate.entryId}`}
                              checked={index >= 0}
                              disabled={
                                index < 0 && field.value.length >= count
                              }
                              onCheckedChange={(checked) =>
                                field.onChange(
                                  checked
                                    ? [...field.value, candidate.entryId]
                                    : field.value.filter(
                                        (id) => id !== candidate.entryId,
                                      ),
                                )
                              }
                            />
                            <Label
                              htmlFor={`winner-${candidate.entryId}`}
                              className="min-w-0 flex-1 flex-col items-start gap-1 leading-5"
                            >
                              <span className="break-words">
                                {candidate.work.author}
                              </span>
                              <span className="font-normal text-muted-foreground">
                                {candidate.work.albumTitle}
                              </span>
                            </Label>
                          </div>
                          <Link
                            href={routes.contestEntry(candidate.entryId)}
                            target="_blank"
                            className="inline-block py-2 text-sm underline underline-offset-4"
                          >
                            Посмотреть заявку
                          </Link>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )
            }
          />
        </fieldset>
        <div className="space-y-3 rounded-xl border p-4">
          <p className="font-semibold">
            Выбрано: {selected.filter(Boolean).length} из {count}
          </p>
          {selected.some(Boolean) && (
            <ul className="space-y-2">
              {selected.filter(Boolean).map((id) => (
                <li key={id}>
                  {data.candidates.find((candidate) => candidate.entryId === id)
                    ?.work.author ?? "Работа больше не допущена"}
                </li>
              ))}
            </ul>
          )}
          {selected.some(Boolean) && (
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() =>
                form.setValue(
                  "entryIds",
                  data.contest.prizeMode === "PLACES"
                    ? Array(count).fill("")
                    : [],
                )
              }
            >
              Сбросить выбор
            </Button>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button
            type="submit"
            ref={publishButtonRef}
            disabled={
              isPending ||
              Boolean(data.blocker) ||
              selected.filter(Boolean).length !== count
            }
          >
            {count ? "Опубликовать результаты" : "Завершить без победителей"}
          </Button>
        </div>
      </form>
      <AlertDialog
        open={Boolean(confirmation)}
        onOpenChange={(open) => {
          if (!open && !isPending) setConfirmation(null);
        }}
      >
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            publishButtonRef.current?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>
              {count
                ? "Опубликовать результаты?"
                : "Завершить без победителей?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Результаты появятся на сайте. Изменить их после публикации нельзя.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirmation && confirmation.entryIds.length > 0 && (
            <ul className="max-h-60 space-y-2 overflow-y-auto">
              {confirmation.entryIds.map((id, index) => (
                <li key={id}>
                  {data.contest.prizeMode === "PLACES" &&
                    `${places[index]}-е место — `}
                  {data.candidates.find((candidate) => candidate.entryId === id)
                    ?.work.author ?? "Участник"}
                </li>
              ))}
            </ul>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="outline" disabled={isPending}>
                Вернуться к выбору
              </Button>
            </AlertDialogCancel>
            <Button disabled={isPending} onClick={() => void publish()}>
              {isPending ? "Публикуем…" : "Опубликовать"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function RankedWinnerPicker({
  groups,
  candidates,
  selected,
  onChange,
}: {
  groups: ReturnType<typeof rankedSelectionGroups>;
  candidates: ContestDrawData["candidates"];
  selected: string[];
  onChange: (entryIds: string[]) => void;
}) {
  return (
    <div className="space-y-4">
      {groups.map(({ place, title, slots }) => (
        <Card key={place}>
          <CardContent className="space-y-4 pt-5">
            <h4 className="flex items-center gap-2 font-medium">
              <ContestPlaceIcon place={place} className="size-6" />
              {place}-е место · {title}
            </h4>
            {slots.map((index, position) => {
              const controlId = `place-${place}-winner-${position + 1}`;
              const selectedId = selected[index];
              const candidate = candidates.find(
                (item) => item.entryId === selectedId,
              );
              return (
                <div className="space-y-2" key={controlId}>
                  <Label htmlFor={controlId}>
                    <span className="sr-only">{place}-е место · </span>
                    {slots.length > 1 ? `Работа ${position + 1}` : "Работа"}
                  </Label>
                  <Select
                    value={selectedId || "none"}
                    onValueChange={(value) =>
                      onChange(
                        selected.map((id, slot) =>
                          slot === index ? (value === "none" ? "" : value) : id,
                        ),
                      )
                    }
                  >
                    <SelectTrigger id={controlId} className="min-h-11 w-full">
                      <SelectValue placeholder="Выберите работу" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Выберите работу</SelectItem>
                      {candidates.map((item) => (
                        <SelectItem
                          key={item.entryId}
                          value={item.entryId}
                          disabled={
                            selected.includes(item.entryId) &&
                            selectedId !== item.entryId
                          }
                        >
                          {item.work.author} · {item.work.albumTitle}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {candidate && (
                    <div className="flex items-center gap-4">
                      <Image
                        src={candidate.work.image}
                        alt={candidate.work.title}
                        width={88}
                        height={88}
                        unoptimized
                        className="size-22 rounded-lg bg-muted object-contain"
                      />
                      <Link
                        href={routes.contestEntry(candidate.entryId)}
                        target="_blank"
                        className="text-sm underline"
                      >
                        Посмотреть заявку
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
