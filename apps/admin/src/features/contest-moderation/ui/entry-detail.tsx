"use client";
import Image from "next/image";
import Link from "next/link";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useContestEntry,
  useContestEntryPhoto,
  contestEntryStatusLabels,
  formatEntryDate,
  type ContestEntry,
} from "@/entities/contest-entry";
import { routes } from "@/shared/constants";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/shared/ui";
import {
  decisionFormSchema,
  type DecisionFormValues,
} from "../lib/decision-form";
import { useDecideContestEntry } from "../model/use-decide-contest-entry";
export function ContestEntryDetail({ entryId }: { entryId: string }) {
  const { entry, isPending, isError, refetch } = useContestEntry(entryId);
  const {
    photoUrl,
    isError: isPhotoError,
    refetch: refetchPhoto,
  } = useContestEntryPhoto(entryId, entry?.revisionId ?? "");
  if (isPending) return <p role="status">Загружаем заявку…</p>;
  if (isError || !entry)
    return (
      <div className="space-y-3">
        <p>Не удалось загрузить заявку</p>
        <Button variant="outline" onClick={() => void refetch()}>
          Повторить
        </Button>
      </div>
    );
  return (
    <div className="space-y-6">
      <Link
        href={routes.contestEntries(entry.contest.id)}
        className="text-sm underline underline-offset-4"
      >
        ← {entry.contest.title}
      </Link>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(20rem,1fr)]">
        <div className="relative flex min-h-80 items-center justify-center overflow-hidden rounded-2xl border bg-muted/20 lg:min-h-[36rem]">
          {photoUrl ? (
            <Image
              src={photoUrl}
              alt={`Работа ${entry.author.name}`}
              fill
              unoptimized
              className="object-contain"
            />
          ) : isPhotoError ? (
            <Button variant="outline" onClick={() => void refetchPhoto()}>
              Загрузить фото ещё раз
            </Button>
          ) : (
            <p role="status">Загружаем фотографию…</p>
          )}
        </div>
        <div className="space-y-5">
          <Card>
            <CardContent className="space-y-4">
              <Badge variant="secondary">
                {contestEntryStatusLabels[entry.status]}
              </Badge>
              <div>
                <h2 className="text-xl font-semibold">{entry.author.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {entry.author.email}
                </p>
              </div>
              <p>
                {entry.albumTitle}
                {entry.number ? ` · № ${entry.number}` : ""}
              </p>
              {entry.caption && (
                <p className="whitespace-pre-wrap">{entry.caption}</p>
              )}
              <p className="text-sm text-muted-foreground">
                Отправлена {formatEntryDate(entry.createdAt)}
              </p>
              {entry.reason && (
                <p className="rounded-lg bg-muted p-3 text-sm">
                  {entry.reason}
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-3 text-sm">
              <h2 className="font-semibold">Правила и согласия</h2>
              {entry.legalAcceptance ? (
                <>
                  <p>
                    {entry.legalAcceptance.actor.name} ·{" "}
                    {entry.legalAcceptance.actor.email}
                  </p>
                  <p>
                    Площадки:{" "}
                    {entry.legalAcceptance.publication.resources
                      .map((resource) => resource.label)
                      .join(", ")}
                  </p>
                  <p>
                    Публикация:{" "}
                    {entry.legalAcceptance.publication.fields
                      .map(
                        (field) =>
                          ({
                            photo: "фотография",
                            contest: "конкурс",
                            album: "альбом",
                            winner: "победа и приз",
                            author: "имя",
                            caption: "подпись",
                            number: "номер картинки",
                          })[field] ?? field,
                      )
                      .join(", ")}
                  </p>
                  <p>{entry.legalAcceptance.publication.restriction}</p>
                  <ul className="space-y-2">
                    {entry.consentAcceptances.map((acceptance) => (
                      <li key={acceptance.id}>
                        {acceptance.revision.documentTitle} ·{" "}
                        {acceptance.revision.version}
                        <br />
                        <span className="text-muted-foreground">
                          Подтверждено {formatEntryDate(acceptance.acceptedAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-muted-foreground">
                  Для этой заявки подтверждения новой редакции не получены.
                </p>
              )}
            </CardContent>
          </Card>
          {(entry.status === "PENDING" ||
            entry.status === "CHANGES_REQUESTED" ||
            entry.status === "APPROVED" ||
            entry.status === "HIDDEN") && (
            <DecisionForm
              key={`${entry.id}:${entry.version}`}
              entry={entry}
              onReload={() => void refetch()}
            />
          )}
        </div>
      </div>
      <section className="max-w-3xl space-y-3 rounded-xl border p-5">
        <h2 className="text-xl font-semibold">Задание конкурса</h2>
        <p className="whitespace-pre-wrap">{entry.contest.task}</p>
        <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          {entry.contest.rules.map((rule, index) => (
            <li key={index}>{rule}</li>
          ))}
        </ul>
      </section>
      <section className="max-w-3xl space-y-4">
        <h2 className="text-xl font-semibold">История заявки</h2>
        <ol className="divide-y rounded-xl border px-5">
          {entry.events.map((event) => (
            <li key={event.id} className="space-y-1 py-4">
              <p className="font-medium">
                {event.status === "PENDING"
                  ? "Работа отправлена на проверку"
                  : contestEntryStatusLabels[event.status]}
              </p>
              <p className="text-sm text-muted-foreground">
                {event.actor} · {formatEntryDate(event.createdAt)} · Версия фото{" "}
                {event.revision}
              </p>
              {event.reason && (
                <p className="whitespace-pre-wrap text-sm">{event.reason}</p>
              )}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
function DecisionForm({
  entry,
  onReload,
}: {
  entry: ContestEntry;
  onReload(): void;
}) {
  const form = useForm<DecisionFormValues>({
    resolver: zodResolver(decisionFormSchema),
    defaultValues: {
      status: entry.status === "APPROVED" ? "HIDDEN" : "APPROVED",
      reason: "",
    },
  });
  const status = useWatch({ control: form.control, name: "status" });
  const { mutate, isPending } = useDecideContestEntry(entry.id);
  const labels = {
    APPROVED: "Одобрить",
    CHANGES_REQUESTED: "Вернуть на исправление",
    REJECTED: "Отклонить",
    HIDDEN: "Скрыть работу",
  };
  const options =
    entry.status === "APPROVED"
      ? (["HIDDEN"] as const)
      : entry.status === "HIDDEN"
        ? (["APPROVED"] as const)
        : entry.status === "CHANGES_REQUESTED"
          ? (["APPROVED", "REJECTED"] as const)
          : (["APPROVED", "CHANGES_REQUESTED", "REJECTED"] as const);
  return (
    <Card>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(async (values) => {
            form.clearErrors("root");
            try {
              await mutate({ ...values, version: entry.version });
            } catch (error) {
              form.setError("root", {
                message:
                  error instanceof Error
                    ? error.message
                    : "Не удалось сохранить решение",
              });
            }
          })}
        >
          <fieldset disabled={isPending} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="entry-decision">Решение</Label>
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger
                      id="entry-decision"
                      className="w-full"
                      ref={field.ref}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {options
                        .filter(
                          (value) =>
                            value !== "CHANGES_REQUESTED" ||
                            Date.now() <
                              new Date(entry.contest.closesAt).getTime(),
                        )
                        .map((value) => (
                          <SelectItem key={value} value={value}>
                            {labels[value]}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            {status !== "APPROVED" && (
              <div className="space-y-2">
                <Label htmlFor="entry-reason">Причина для участника</Label>
                <Textarea
                  id="entry-reason"
                  rows={4}
                  maxLength={1000}
                  {...form.register("reason")}
                  aria-invalid={Boolean(form.formState.errors.reason)}
                />
                {form.formState.errors.reason && (
                  <p role="alert" className="text-sm text-destructive">
                    {form.formState.errors.reason.message}
                  </p>
                )}
              </div>
            )}
            <Button
              type="submit"
              className="w-full"
              variant={
                status === "HIDDEN" || status === "REJECTED"
                  ? "destructive"
                  : "default"
              }
            >
              {isPending ? "Сохраняем…" : labels[status]}
            </Button>
          </fieldset>
          {form.formState.errors.root && (
            <div className="space-y-3">
              <p role="alert" className="text-sm text-destructive">
                {form.formState.errors.root.message}
              </p>
              <Button type="button" variant="outline" onClick={onReload}>
                Обновить заявку
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
