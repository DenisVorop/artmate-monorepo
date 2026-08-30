"use client";

import { useColoringData } from "@/entities/coloring";
import { Button, DataState } from "@/shared/ui";

import { ComparisonViewer } from "./comparison-viewer";
import { Hero } from "./hero";
import { PaletteSection } from "./palette-section";

type ColoringDetailsProps = {
  collectionSlug: string;
  number: number;
  publishedRevisionId: string;
};

export function ColoringDetails({
  collectionSlug,
  number,
  publishedRevisionId,
}: ColoringDetailsProps) {
  const { coloring, isError, isPending, refetch } = useColoringData(
    collectionSlug,
    number,
    publishedRevisionId,
  );

  if (isPending) {
    return (
      <main className="container py-10">
        <DataState
          title="Загружаем раскраску"
          description="Подготавливаем контур и цветную версию."
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
          <Button type="button" className="min-h-11" onClick={() => void refetch()}>
            Повторить
          </Button>
        </div>
      </main>
    );
  }

  const coloringTitle = `Картина ${coloring.number}`;
  return (
    <main className="overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(251,113,133,0.09),transparent_34rem)]">
      <Hero
        collection={coloring.collection}
        description={coloring.description}
        title={coloringTitle}
      />

      <section
        className="w-full px-6 pb-10 md:px-8 md:pb-14"
        aria-label={`Сравнение версий «${coloringTitle}»`}
      >
        <div className="mx-auto w-full max-w-[100rem]">
          <ComparisonViewer
            key={coloring.publishedRevisionId}
            colored={coloring.colored}
            outline={coloring.outline}
            width={coloring.width}
            height={coloring.height}
          />
        </div>
      </section>

      <div className="container space-y-6 pb-12 md:space-y-8 md:pb-16">
        <PaletteSection palette={coloring.palette} themes={coloring.themes} />

        <aside className="max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950 sm:p-6">
          <h2 className="mb-2 text-base font-bold">О передаче цвета</h2>
          <p>
            Цвет на экране — ориентир. Итоговый оттенок зависит от бумаги, освещения, количества
            слоёв и настроек дисплея. Для выбора используйте физическую выкраску Artmate.
          </p>
        </aside>
      </div>
    </main>
  );
}
