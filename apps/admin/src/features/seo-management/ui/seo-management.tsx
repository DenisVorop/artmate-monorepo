"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";

import {
  getSeoEntryDisplayTitle,
  getSeoStatusLabel,
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

import { useSeoManagement } from "../model";
import { SeoEntryForm } from "./entry-form";
import { SnapshotsPanel } from "./snapshots-panel";

export function SeoManagement() {
  const { categories, entries, isError, isPending, products, refreshSeoView } =
    useSeoManagement();
  const [selectedEntryId, setSelectedEntryId] = useState<string | undefined>();
  const [isCreateMode, setIsCreateMode] = useState(false);
  const selectedEntry = useMemo(
    () =>
      isCreateMode
        ? undefined
        : entries.find((entry) => entry.id === selectedEntryId) ?? entries[0],
    [entries, isCreateMode, selectedEntryId],
  );

  useEffect(() => {
    if (entries.length === 0) {
      setSelectedEntryId(undefined);
      setIsCreateMode(true);

      return;
    }

    if (isCreateMode) {
      return;
    }

    const firstEntry = entries[0];

    if (!firstEntry) {
      return;
    }

    if (!selectedEntryId) {
      setSelectedEntryId(firstEntry.id);
    }

    if (selectedEntryId && !entries.some((entry) => entry.id === selectedEntryId)) {
      setSelectedEntryId(firstEntry.id);
    }
  }, [entries, isCreateMode, selectedEntryId]);

  const handleCreateEntry = () => {
    setIsCreateMode(true);
    setSelectedEntryId(undefined);
  };
  const handleSelectEntry = (entryId: string) => {
    setIsCreateMode(false);
    setSelectedEntryId(entryId);
  };

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Не удалось загрузить SEO</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Перезагрузите страницу и повторите действие.
        </CardContent>
      </Card>
    );
  }

  if (isPending) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Загрузка SEO</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Получаем SEO записи, товары и категории.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)]">
      <div className="min-w-0 xl:sticky xl:top-8 xl:self-start">
        <SeoEntriesList
          entries={entries}
          isCreateMode={isCreateMode}
          onCreateEntry={handleCreateEntry}
          onSelectEntry={handleSelectEntry}
          selectedEntryId={selectedEntry?.id}
        />
      </div>

      <div className="grid min-w-0 content-start gap-4">
        <SeoEntryForm
          key={selectedEntry?.id ?? "new"}
          categories={categories}
          entry={selectedEntry}
          onDeleted={() => {
            setIsCreateMode(true);
            setSelectedEntryId(undefined);
          }}
          onSaved={refreshSeoView}
          products={products}
        />
        {selectedEntry ? (
          <SnapshotsPanel entry={selectedEntry} onChange={refreshSeoView} />
        ) : null}
      </div>
    </div>
  );
}

function SeoEntriesList({
  entries,
  isCreateMode,
  onCreateEntry,
  onSelectEntry,
  selectedEntryId,
}: {
  readonly entries: readonly SeoEntry[];
  readonly isCreateMode: boolean;
  readonly onCreateEntry: () => void;
  readonly onSelectEntry: (entryId: string) => void;
  readonly selectedEntryId?: string;
}) {
  if (entries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Записи</CardTitle>
          <CardDescription>SEO записи пока не созданы.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            className="w-full justify-start"
            onClick={onCreateEntry}
            type="button"
          >
            <Plus data-icon="inline-start" aria-hidden="true" />
            Новая запись
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Записи</CardTitle>
        <CardDescription>{entries.length} paths</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2">
          <Button
            className="justify-start"
            onClick={onCreateEntry}
            type="button"
            variant={isCreateMode ? "secondary" : "outline"}
          >
            <Plus data-icon="inline-start" aria-hidden="true" />
            Новая запись
          </Button>
          {entries.map((entry) => (
            <Button
              className="h-auto justify-start px-3 py-2 text-left"
              key={entry.id}
              onClick={() => onSelectEntry(entry.id)}
              type="button"
              variant={entry.id === selectedEntryId ? "secondary" : "ghost"}
            >
              <span className="grid min-w-0 gap-1">
                <span className="truncate font-medium">
                  {getSeoEntryDisplayTitle(entry)}
                </span>
                <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{getSeoStatusLabel(entry.status)}</Badge>
                  {entry.draftSnapshot ? (
                    <span>draft v{entry.draftSnapshot.version}</span>
                  ) : null}
                  {entry.publishedSnapshot ? (
                    <span>public v{entry.publishedSnapshot.version}</span>
                  ) : null}
                </span>
              </span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
