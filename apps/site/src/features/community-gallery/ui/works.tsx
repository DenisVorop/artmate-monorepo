"use client";

import { lazy, Suspense, useCallback, useEffect, useState, type ComponentType } from "react";
import { useGalleryWorks, type GalleryWorksFilters } from "@/entities/community-work";
import { Button, DataState } from "@/shared/ui";
import { scheduleIdlePreload } from "@/shared/lib/schedule-idle-preload";

import { useImagePreview } from "../lib/use-image-preview";
import { useWorksScroll } from "../lib/use-works-scroll";
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
    workPages,
    isPending,
    isError,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useGalleryWorks(filters);
  const preview = useImagePreview();
  const endRef = useWorksScroll({
    count: works.length,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    paused: preview.isOpen,
    fetchNextPage,
  });
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
      <Mosaic
        workPages={workPages}
        onOpenImage={preview.openImage}
        onPreviewIntent={preloadImagePreview}
      />
      {hasNextPage && (
        <div
          ref={endRef}
          className="flex min-h-16 flex-col items-center justify-center gap-3"
          aria-busy={isFetchingNextPage}
        >
          {isFetchNextPageError ? (
            <>
              <p role="status" className="text-sm text-stone-600">
                Не удалось загрузить следующие работы.
              </p>
              <Button variant="outline" className="min-h-11" onClick={() => void fetchNextPage()}
                data-site-action="gallery_load_more">
                Повторить
              </Button>
            </>
          ) : (
            <>
              <p role="status" className="text-sm text-stone-500">
                {isFetchingNextPage ? "Загружаем работы…" : ""}
              </p>
              <Button
                variant="outline"
                className="sr-only min-h-11 focus:not-sr-only"
                disabled={isFetchingNextPage}
                onClick={() => void fetchNextPage()}
                data-site-action="gallery_load_more"
              >
                Загрузить следующие работы
              </Button>
            </>
          )}
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
