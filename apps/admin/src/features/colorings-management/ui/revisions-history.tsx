"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import type { ColoringRevision } from "@/entities/colorings";
import { Button } from "@/shared/ui";

import { RevisionCard } from "./revision-card";

export function RevisionsHistory({
  coloringId,
  disabled,
  publishedRevisionId,
  revisions,
}: {
  readonly coloringId: string;
  readonly disabled: boolean;
  readonly publishedRevisionId?: string;
  readonly revisions: readonly ColoringRevision[];
}) {
  const [showPrevious, setShowPrevious] = useState(false);

  if (!revisions.length) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Ревизий пока нет. Загрузите первую пару изображений.
      </div>
    );
  }

  const ordered = [...revisions].sort((left, right) => right.version - left.version);
  const current = ordered.find(({ id }) => id === publishedRevisionId);
  const latestWorking = ordered.find(({ id }) => id !== publishedRevisionId);
  const remaining = ordered.filter(
    ({ id }) => id !== current?.id && id !== latestWorking?.id,
  );

  return (
    <div className="grid gap-8">
      <RevisionGroup emptyText="Опубликованной ревизии пока нет." title="Текущая опубликованная">
        {current ? (
          <RevisionCard
            coloringId={coloringId}
            disabled={disabled}
            isCurrentPublished
            revision={current}
          />
        ) : null}
      </RevisionGroup>
      <RevisionGroup emptyText="Рабочей ревизии отдельно от опубликованной пока нет." title="Последняя рабочая">
        {latestWorking ? (
          <RevisionCard
            coloringId={coloringId}
            disabled={disabled}
            isCurrentPublished={false}
            revision={latestWorking}
          />
        ) : null}
      </RevisionGroup>
      {remaining.length ? (
        <RevisionGroup title="Предыдущие ревизии">
          <div className="grid gap-3">
            <div>
              <Button
                onClick={() => setShowPrevious((visible) => !visible)}
                type="button"
                variant="outline"
              >
                {showPrevious
                  ? "Скрыть предыдущие"
                  : `Показать предыдущие (${remaining.length})`}
              </Button>
            </div>
            {showPrevious ? (
              <div className="grid gap-4 xl:grid-cols-2">
                {remaining.map((revision) => (
                  <RevisionCard
                    coloringId={coloringId}
                    disabled={disabled}
                    isCurrentPublished={false}
                    key={revision.id}
                    revision={revision}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </RevisionGroup>
      ) : null}
    </div>
  );
}

function RevisionGroup({
  children,
  emptyText,
  title,
}: {
  readonly children?: ReactNode;
  readonly emptyText?: string;
  readonly title: string;
}) {
  return (
    <section className="grid gap-3">
      <h3 className="text-base font-semibold">{title}</h3>
      {children ?? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          {emptyText}
        </p>
      )}
    </section>
  );
}
