"use client";

import type { ReactNode } from "react";

import { useColoringVariantsData } from "@/entities/coloring-variants";
import { Button, DataState } from "@/shared/ui";

import { useViewerAnalytics } from "../lib/analytics";
import { useTrackOpen } from "../lib/use-track-open";
import { PaletteViewer } from "./palette-viewer";

type ColoringVariantsProps = {
  collectionSlug: string;
  number: number;
  token: string;
  communityWorks?: ReactNode;
};

export function ColoringVariants({
  collectionSlug,
  number,
  token,
  communityWorks,
}: ColoringVariantsProps) {
  const { coloring, isError, isPending, refetch } = useColoringVariantsData(
    collectionSlug,
    number,
    token,
  );
  const analytics = useViewerAnalytics(collectionSlug, number);
  useTrackOpen(
    !isPending && !isError ? coloring?.collection.slug : undefined,
    !isPending && !isError ? coloring?.number : undefined,
  );

  if (isPending) {
    return (
      <main className="container py-10">
        <DataState
          title="Загружаем раскраску"
          description="Подготавливаем контур и цветные версии."
        />
      </main>
    );
  }

  if (isError || !coloring) {
    return (
      <main className="container py-10">
        <DataState
          variant="error"
          title="Не удалось загрузить раскраску"
          description="Проверьте соединение и попробуйте ещё раз."
        />
        <div className="mt-4 flex justify-center">
          <Button type="button" className="min-h-11" onClick={() => {
            analytics.pictureRetried();
            void refetch();
          }}>
            Повторить
          </Button>
        </div>
      </main>
    );
  }

  return <PaletteViewer key={coloring.token} coloring={coloring} communityWorks={communityWorks} />;
}
