"use client";

import Image from "next/image";
import { Camera, ExternalLink, Lock, Pencil, Plus, Trash2 } from "lucide-react";

import { routes } from "@/shared/constants";
import { Badge, Button, Card, CardContent, CardFooter, CardTitle } from "@/shared/ui";
import { Link } from "@/shared/ui/link";

import { OwnerAssetImage } from "./owner-asset-image";
import type { OwnerWorkshopCollection, WorkshopWork } from "../model";

type WorkshopColoring = OwnerWorkshopCollection["colorings"][number];

type WorkshopColoringCardProps = {
  collectionSlug: string;
  coloring: WorkshopColoring;
  onDelete?: (_work: WorkshopWork) => void;
  onPublish?: (_work: WorkshopWork) => void;
  onUnpublish?: (_work: WorkshopWork) => void;
  isMutating?: boolean;
};

export function WorkshopColoringCard({
  collectionSlug,
  coloring,
  onDelete,
  onPublish,
  onUnpublish,
  isMutating,
}: WorkshopColoringCardProps) {
  const work = coloring.work;
  const editorHref = routes.workshopColoring(collectionSlug, coloring.number);
  const state = getWorkState(work);
  const currentStatus = work?.currentRevision?.status;
  const isPublished = state === "PUBLISHED";
  const publicHref = isPublished && work ? routes.publicWork(work.publicId) : undefined;
  const displayedRevision = isPublished ? work?.publishedRevision : work?.currentRevision;
  const cardHref = getCardHref(work, editorHref, publicHref);

  const image = (
    <div className="relative aspect-[4/5] overflow-hidden bg-stone-100">
      {displayedRevision ? (
        <OwnerAssetImage
          revisionId={displayedRevision.id}
          alt={`Работа по картине ${coloring.number}: ${coloring.title}`}
          className="object-cover"
        />
      ) : (
        <>
          <Image
            fill
            unoptimized
            src={coloring.officialImage.url}
            alt={coloring.officialImage.alt}
            className="object-cover opacity-55 saturate-[0.75]"
          />
          <span className="absolute right-3 bottom-3 flex min-h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-bold text-rose-700 shadow-md">
            <Camera className="size-4" aria-hidden="true" />
            Добавить работу
          </span>
        </>
      )}
    </div>
  );

  return (
    <Card className="h-full gap-0 overflow-hidden py-0">
      {cardHref ? (
        <Link
          href={cardHref}
          className="block focus-visible:ring-3 focus-visible:ring-rose-400 focus-visible:outline-none"
          aria-label={getCardLabel(work, coloring.number)}
        >
          {image}
        </Link>
      ) : (
        image
      )}

      <CardContent className="space-y-3 px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-snug">
            {coloring.number}. {coloring.title}
          </CardTitle>
          {work ? <WorkStatusBadge work={work} /> : null}
        </div>

        {currentStatus === "CHANGES_REQUESTED" ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            <p className="font-bold">Модератор запросил изменения</p>
            <p className="mt-1">
              {work?.currentRevision?.moderationReason ??
                "Обновите фото или описание и отправьте работу повторно."}
            </p>
          </div>
        ) : null}

        {currentStatus === "HIDDEN" && work?.currentRevision?.moderationReason ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-950">
            <p className="font-bold">Работа скрыта модератором</p>
            <p className="mt-1">{work.currentRevision.moderationReason}</p>
          </div>
        ) : null}

        {hasUnpublishedChanges(work) ? (
          <p className="text-sm font-semibold text-amber-700">Есть неопубликованные изменения</p>
        ) : null}

        {currentStatus === "PENDING" ? (
          <p className="text-sm font-semibold text-amber-700">Новая версия ожидает модерации</p>
        ) : null}
      </CardContent>

      <CardFooter className="mt-auto flex flex-wrap gap-2 border-t bg-stone-50/70 px-4 py-3">
        {!work ? (
          <Button asChild className="min-h-11 flex-1">
            <Link href={editorHref}>
              <Plus data-icon="inline-start" />
              Добавить работу
            </Link>
          </Button>
        ) : (
          <>
            {(currentStatus === "DRAFT" ||
              currentStatus === "CHANGES_REQUESTED" ||
              currentStatus === "HIDDEN") && (
              <Button asChild className="min-h-11 flex-1">
                <Link href={editorHref}>
                  <Pencil data-icon="inline-start" />
                  {currentStatus === "DRAFT" ? "Продолжить" : "Исправить"}
                </Link>
              </Button>
            )}
            {currentStatus === "APPROVED" ? (
              <Button asChild variant="outline" className="min-h-11 flex-1">
                <Link href={editorHref}>
                  <Camera data-icon="inline-start" />
                  Заменить фото
                </Link>
              </Button>
            ) : null}
            {currentStatus === "PENDING" ? (
              <p className="min-h-11 flex-1 content-center text-sm font-semibold text-stone-600">
                Дождитесь решения модератора
              </p>
            ) : null}
            {state === "APPROVED_PRIVATE" && onPublish ? (
              <Button
                type="button"
                className="min-h-11 flex-1"
                disabled={isMutating}
                onClick={() => onPublish(work)}
              >
                Опубликовать
              </Button>
            ) : null}
            {state === "PUBLISHED" && publicHref ? (
              <Button asChild variant="outline" className="min-h-11 flex-1">
                <Link href={publicHref}>
                  <ExternalLink data-icon="inline-start" />
                  Открыть
                </Link>
              </Button>
            ) : null}
            {state === "PUBLISHED" && onUnpublish ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={isMutating}
                onClick={() => onUnpublish(work)}
              >
                Скрыть
              </Button>
            ) : null}
            {onDelete && currentStatus !== "PENDING" ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                aria-label={`Удалить работу ${coloring.number}`}
                disabled={isMutating}
                onClick={() => onDelete(work)}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            ) : null}
          </>
        )}
      </CardFooter>
    </Card>
  );
}

function WorkStatusBadge({ work }: { work: WorkshopWork }) {
  switch (getWorkState(work)) {
    case "DRAFT":
      return <Badge variant="secondary">Черновик</Badge>;
    case "PENDING":
      return <Badge className="bg-amber-100 text-amber-900">На проверке</Badge>;
    case "CHANGES_REQUESTED":
      return <Badge className="bg-orange-100 text-orange-900">Нужны правки</Badge>;
    case "APPROVED_PRIVATE":
      return (
        <Badge variant="secondary" className="gap-1">
          <Lock aria-hidden="true" />
          Видно только вам
        </Badge>
      );
    case "PUBLISHED":
      return <Badge className="bg-emerald-100 text-emerald-800">Опубликовано</Badge>;
    case "HIDDEN":
      return <Badge variant="destructive">Скрыто модератором</Badge>;
  }
}

function getCardHref(
  work: WorkshopWork | undefined,
  editorHref: string,
  publicHref: string | undefined,
) {
  if (!work) {
    return editorHref;
  }

  if (work.currentRevision?.status === "PENDING") {
    return publicHref ?? editorHref;
  }

  return getWorkState(work) === "PUBLISHED" ? publicHref : editorHref;
}

function getCardLabel(work: WorkshopWork | undefined, number: number) {
  if (!work) return `Добавить работу для картины ${number}`;
  const state = getWorkState(work);
  if (state === "DRAFT") return `Продолжить черновик картины ${number}`;
  if (state === "CHANGES_REQUESTED" || state === "HIDDEN") {
    return `Исправить работу для картины ${number}`;
  }
  if (state === "PENDING") return `Открыть работу на проверке для картины ${number}`;
  if (state === "APPROVED_PRIVATE") return `Открыть приватную работу для картины ${number}`;
  return `Открыть опубликованную работу для картины ${number}`;
}

type WorkState =
  | "DRAFT"
  | "PENDING"
  | "CHANGES_REQUESTED"
  | "APPROVED_PRIVATE"
  | "PUBLISHED"
  | "HIDDEN";

function getWorkState(work: WorkshopWork | undefined): WorkState | undefined {
  if (!work?.currentRevision) return undefined;
  if (work.isPublicationEnabled && work.publishedRevision && work.publishedAt) return "PUBLISHED";
  if (work.currentRevision.status === "APPROVED") return "APPROVED_PRIVATE";
  return work.currentRevision.status;
}

function hasUnpublishedChanges(work: WorkshopWork | undefined) {
  return Boolean(
    work?.isPublicationEnabled &&
    work.currentRevision &&
    work.publishedRevision &&
    work.currentRevision.id !== work.publishedRevision.id,
  );
}
