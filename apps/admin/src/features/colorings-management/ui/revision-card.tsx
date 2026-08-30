"use client";

import { Rocket } from "lucide-react";

import type { ColoringRevision } from "@/entities/colorings";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/ui";

import { usePublishColoringRevision } from "../model";
import { RevisionAsset } from "./revision-asset";
import { RevisionPalette } from "./revision-palette";
import { RevisionReviewForm } from "./revision-review-form";

const statusLabels = {
  approved: "Одобрена",
  published: "Опубликована",
  rejected: "Отклонена",
  review_required: "Нужна проверка",
} as const;

export function RevisionCard({
  coloringId,
  disabled,
  isCurrentPublished,
  revision,
}: {
  readonly coloringId: string;
  readonly disabled: boolean;
  readonly isCurrentPublished: boolean;
  readonly revision: ColoringRevision;
}) {
  const { isPending, mutate } = usePublishColoringRevision();

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-1">
          <CardTitle>Ревизия v{revision.version}</CardTitle>
          <p className="text-xs text-muted-foreground">
            {new Intl.DateTimeFormat("ru-RU", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(revision.createdAt))}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge
            variant={revision.status === "rejected" ? "destructive" : "outline"}
          >
            {statusLabels[revision.status]}
          </Badge>
          {isCurrentPublished ? <Badge>Текущая публикация</Badge> : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-5">
        <dl className="grid gap-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Палитра</dt>
            <dd>{revision.paletteLabel}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Версия палитры</dt>
            <dd>{revision.paletteVersion}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Использовано цветов</dt>
            <dd>{revision.usedColorCount}</dd>
          </div>
        </dl>
        <RevisionPalette paletteColors={revision.paletteColors} />
        <div className="grid gap-4 sm:grid-cols-2">
          <RevisionAsset
            alt={revision.outline.alt}
            label="Контур"
            previewUrl={revision.outline.previewUrl}
          />
          <RevisionAsset
            alt={revision.colored.alt}
            label="Цветной образец"
            previewUrl={revision.colored.previewUrl}
          />
        </div>
        {revision.review ? (
          <div className="rounded-lg border px-3 py-2 text-sm">
            <p className="font-medium">
              Ревью:{" "}
              {revision.review.decision === "approved"
                ? "одобрено"
                : "отклонено"}
            </p>
            {revision.review.comment ? (
              <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                {revision.review.comment}
              </p>
            ) : null}
          </div>
        ) : null}
        {revision.status === "review_required" ? (
          <RevisionReviewForm
            coloringId={coloringId}
            disabled={disabled}
            revisionId={revision.id}
          />
        ) : null}
        {revision.status === "approved" ? (
          <div>
            <Button
              disabled={disabled || isPending}
              onClick={() => mutate({ coloringId, revisionId: revision.id })}
              type="button"
            >
              <Rocket data-icon="inline-start" aria-hidden="true" />
              {isPending ? "Публикуем..." : "Опубликовать ревизию"}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
