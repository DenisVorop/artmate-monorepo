"use client";

import type { ReactNode } from "react";

import {
  useColoring,
  useColoringRevisions,
  useColorings,
} from "@/entities/colorings";
import { useMarkerColors } from "@/entities/marker-colors";
import { useColoringCollections } from "@/entities/coloring-collections";
import { useTags } from "@/entities/products";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui";

import { MetadataForm } from "./metadata-form";
import { RevisionsHistory } from "./revisions-history";
import { RevisionUploadForm } from "./revision-upload-form";

export type ColoringDetailsProps = {
  readonly collectionId: string;
  readonly coloringId: string;
};

export function ColoringDetails({
  collectionId,
  coloringId,
}: ColoringDetailsProps) {
  const {
    coloring,
    isError: isColoringError,
    isPending: isColoringPending,
  } = useColoring({ coloringId });
  const {
    colorings,
    isError: isColoringsError,
    isPending: isColoringsPending,
  } = useColorings();
  const {
    collections,
    isError: isCollectionsError,
    isPending: isCollectionsPending,
  } = useColoringCollections();
  const {
    isError: isRevisionsError,
    isPending: isRevisionsPending,
    revisions,
  } = useColoringRevisions({ coloringId });
  const {
    isError: isMarkerColorsError,
    isPending: isMarkerColorsPending,
    markerColors,
  } = useMarkerColors();
  const { isError: isTagsError, isPending: isTagsPending, tags } = useTags();

  if (
    isColoringError ||
    isColoringsError ||
    isCollectionsError ||
    isRevisionsError ||
    isTagsError
  ) {
    return (
      <DetailsState title="Не удалось загрузить раскраску">
        Обновите страницу и повторите попытку.
      </DetailsState>
    );
  }

  if (
    isColoringPending ||
    isColoringsPending ||
    isCollectionsPending ||
    isRevisionsPending ||
    isTagsPending
  ) {
    return (
      <DetailsState title="Загрузка раскраски">
        Получаем метаданные, коллекции, теги и историю ревизий.
      </DetailsState>
    );
  }

  if (!coloring) {
    return (
      <DetailsState title="Раскраска не найдена">
        Проверьте адрес или вернитесь к списку раскрасок.
      </DetailsState>
    );
  }

  if (coloring.collectionId !== collectionId) {
    return (
      <DetailsState title="Раскраска не входит в эту коллекцию">
        Откройте раскраску из её фактической коллекции.
      </DetailsState>
    );
  }

  const themeTags = tags.filter(({ group }) => group === "theme");
  const isParentArchived = collections.some(
    (collection) =>
      collection.id === coloring.collectionId &&
      collection.status === "archived",
  );
  const workflowDisabled = coloring.status === "archived" || isParentArchived;

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">
            {coloring.collection.title}
          </p>
          <h1 className="truncate text-2xl font-semibold tracking-tight">
            {coloring.title}
          </h1>
        </div>
        <Badge variant="outline">
          {getColoringStatusLabel(coloring.status)}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Метаданные</CardTitle>
          <CardDescription>
            Коллекция, номер в адресе, порядок и тематическая разметка.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MetadataForm
            collections={collections}
            coloring={coloring}
            colorings={colorings}
            disabled={isParentArchived}
            themeTags={themeTags}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Новая парная ревизия</CardTitle>
          <CardDescription>
            Контур и цветной образец загружаются вместе и проходят проверку как
            одна версия.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isMarkerColorsPending ? (
            <MarkerCatalogState title="Загрузка палитры">
              Получаем каталог маркеров Artmate 168.
            </MarkerCatalogState>
          ) : isMarkerColorsError ? (
            <MarkerCatalogState title="Не удалось загрузить палитру">
              Обновите страницу и повторите попытку. Метаданные и история
              ревизий остаются доступны.
            </MarkerCatalogState>
          ) : markerColors.length === 0 ? (
            <MarkerCatalogState title="Каталог маркеров пуст">
              Нельзя создать ревизию без доступной палитры Artmate 168.
            </MarkerCatalogState>
          ) : (
            <RevisionUploadForm
              coloringId={coloring.id}
              disabled={workflowDisabled}
              disabledLabel={
                isParentArchived ? "Коллекция в архиве" : undefined
              }
              markerColors={markerColors}
            />
          )}
        </CardContent>
      </Card>

      <section className="grid gap-4">
        <div>
          <h2 className="text-xl font-semibold">История ревизий</h2>
          <p className="text-sm text-muted-foreground">
            Публикация и последняя рабочая версия показаны отдельно.
          </p>
        </div>
        <RevisionsHistory
          coloringId={coloring.id}
          disabled={workflowDisabled}
          publishedRevisionId={coloring.publishedRevisionId}
          revisions={revisions}
        />
      </section>
    </div>
  );
}

function MarkerCatalogState({
  children,
  title,
}: {
  readonly children: ReactNode;
  readonly title: string;
}) {
  return (
    <div className="grid gap-1 rounded-lg border border-dashed bg-muted/20 p-4">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

function DetailsState({
  children,
  title,
}: {
  readonly children: ReactNode;
  readonly title: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {children}
      </CardContent>
    </Card>
  );
}

function getColoringStatusLabel(status: string) {
  if (status === "published") return "Опубликована";
  if (status === "archived") return "В архиве";
  return "Черновик";
}
