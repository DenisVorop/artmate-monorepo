"use client";

import { RotateCcw } from "lucide-react";

import {
  formatSeoSnapshotTitle,
  getSeoSnapshotKindLabel,
  useSeoSnapshots,
  type SeoEntry,
} from "@/entities/seo";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui";

import type { SeoRefreshCallback } from "../lib";
import { useRollbackSeoEntry } from "../model";

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "2-digit",
  year: "numeric",
});

type SnapshotsPanelProps = {
  readonly entry: SeoEntry;
  readonly onChange: SeoRefreshCallback;
};

export function SnapshotsPanel({ entry, onChange }: SnapshotsPanelProps) {
  const { isError, isPending, refetch, snapshots } = useSeoSnapshots(entry.id);
  const { isPending: isRollingBack, mutate: rollbackEntry } = useRollbackSeoEntry({
    onSuccess: async () => {
      await Promise.all([refetch(), onChange()]);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>История</CardTitle>
        <CardDescription>{entry.path}</CardDescription>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Загружаем snapshots
          </div>
        ) : null}
        {isError ? (
          <div className="rounded-lg border border-destructive/40 p-4 text-sm text-muted-foreground">
            Не удалось загрузить историю
          </div>
        ) : null}
        {!isPending && !isError && snapshots.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            История пока пуста
          </div>
        ) : null}
        <div className="grid gap-2">
          {snapshots.map((snapshot) => (
            <div
              className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_auto]"
              key={snapshot.id}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{formatSeoSnapshotTitle(snapshot)}</p>
                  <Badge variant="outline">
                    {getSeoSnapshotKindLabel(snapshot.kind)}
                  </Badge>
                  {entry.draftSnapshotId === snapshot.id ? (
                    <Badge variant="secondary">Текущий draft</Badge>
                  ) : null}
                  {entry.publishedSnapshotId === snapshot.id ? (
                    <Badge variant="secondary">Public</Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatDate(snapshot.createdAt)}
                  {snapshot.comment ? ` · ${snapshot.comment}` : ""}
                </p>
              </div>
              <Button
                disabled={isRollingBack}
                onClick={() =>
                  rollbackEntry({
                    entryId: entry.id,
                    input: {
                      snapshotId: snapshot.id,
                      comment: `Rollback to v${snapshot.version}`,
                    },
                  })
                }
                size="sm"
                type="button"
                variant="outline"
              >
                <RotateCcw data-icon="inline-start" aria-hidden="true" />
                В черновик
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function formatDate(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}
