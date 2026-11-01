"use client";

import { lazy, Suspense, useCallback, useEffect, useState, type ComponentType } from "react";
import { useGalleryWorks, type GalleryWorksFilters } from "@/entities/community-work";
import { Button, DataState } from "@/shared/ui";
import { scheduleIdlePreload } from "@/shared/lib/schedule-idle-preload";

import { useImagePreview } from "../lib/use-image-preview";
import { Mosaic } from "./mosaic";
import { PreviewLoading } from "./preview-loading";

const loadImagePreview = () =>
  import("./image-preview").then((module) => ({ default: module.ImagePreview }));
const ImagePreview = lazy(loadImagePreview);
type PreviewComponent = ComponentType<{ preview: ReturnType<typeof useImagePreview> }>;

export function GalleryWorks({
  filters,
  onReset,
}: {
  filters: GalleryWorksFilters;
  onReset(): void;
}) {
  const {
    works,
    isPending,
    isError,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useGalleryWorks(filters);
  const preview = useImagePreview();
  const [LoadedPreview, setLoadedPreview] = useState<PreviewComponent | null>(null);
  const preloadImagePreview = useCallback(
    () =>
      loadImagePreview()
        .then((module) => setLoadedPreview(() => module.default))
        .catch(() => undefined),
    [],
  );
  useEffect(() => scheduleIdlePreload(preloadImagePreview), [preloadImagePreview]);
  const Preview = LoadedPreview ?? ImagePreview;

  if (isPending)
    return <DataState title="Загружаем работы" description="Собираем фотографии участников." />;
  if (isError && !works.length)
    return (
      <div className="space-y-4">
        <DataState
          variant="error"
          title="Не удалось загрузить работы"
          description="Попробуйте ещё раз."
        />
        <div className="flex justify-center">
          <Button variant="outline" className="min-h-11" onClick={() => void refetch()}>
            Повторить
          </Button>
        </div>
      </div>
    );
  if (!works.length)
    return (
      <div className="space-y-4">
        <DataState
          title={
            filters.collections?.length || filters.number !== undefined
              ? "Таких работ пока нет"
              : "Работ пока нет"
          }
          description={
            filters.collections?.length || filters.number !== undefined
              ? "Попробуйте выбрать другой альбом или номер картинки."
              : "Поделитесь своей готовой раскраской через мастерскую."
          }
        />
        {(filters.collections?.length || filters.number !== undefined) && (
          <div className="flex justify-center">
            <Button variant="outline" className="min-h-11" onClick={onReset}>
              Показать все работы
            </Button>
          </div>
        )}
      </div>
    );

  return (
    <section aria-label="Галерея работ участников" className="space-y-5 md:space-y-6">
      <Mosaic works={works} onOpenImage={preview.openImage} onPreviewIntent={preloadImagePreview} />
      {hasNextPage && (
        <div className="flex flex-col items-center gap-3 pt-4">
          {isFetchNextPageError && (
            <p role="status" className="text-sm text-stone-600">
              Не удалось загрузить следующие работы. Попробуйте ещё раз.
            </p>
          )}
          <Button
            variant="outline"
            className="min-h-11"
            disabled={isFetchingNextPage}
            onClick={() => void fetchNextPage()}
          >
            {isFetchingNextPage
              ? "Загружаем…"
              : isFetchNextPageError
                ? "Повторить"
                : "Показать ещё"}
          </Button>
        </div>
      )}
      {(LoadedPreview || preview.selectedWork) && (
        <Suspense fallback={<PreviewLoading preview={preview} />}>
          <Preview preview={preview} />
        </Suspense>
      )}
    </section>
  );
}
