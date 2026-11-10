"use client";

import { ArrowLeftRight } from "lucide-react";
import type { ReactNode } from "react";

import type { Coloring } from "@/entities/coloring-variants";
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui";

import { usePaletteState } from "../lib/use-palette-state";
import { useViewerAnalytics } from "../lib/analytics";
import { ComparisonViewer } from "./comparison-viewer";
import { Hero } from "./hero";
import { PaletteSection } from "./palette-section";
import { ProductLinks } from "./product-links";

export function PaletteViewer({
  coloring,
  communityWorks,
}: {
  coloring: Coloring;
  communityWorks?: ReactNode;
}) {
  const state = usePaletteState(coloring);
  const analytics = useViewerAnalytics(coloring.collection.slug, coloring.number);
  const left = state.isComparing ? coloring.original.image : state.palette.outline;
  const right = state.palette.image;

  return (
    <main className="overflow-hidden bg-stone-100/80 text-stone-900">
      <Hero
        collection={coloring.collection}
        description={coloring.description}
        title={`Картина ${coloring.number}`}
        onAlbumClick={() => analytics.printAlbumClicked(coloring.collection.product.id)}
      />
      <div className="container pb-12 md:pb-16">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-y border-stone-200/80 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="coloring-palette" className="text-sm font-semibold">
              Палитра
            </label>
            <Select value={state.palette.id} onValueChange={(id) => {
              if (id === state.palette.id) return;
              state.selectPalette(id);
              analytics.paletteSelected(id);
            }}>
              <SelectTrigger
                id="coloring-palette"
                size="lg"
                className="min-w-[210px] rounded-xl border-stone-200 bg-white px-4 font-semibold"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" className="p-1.5">
                {state.palettes.map((palette) => (
                  <SelectItem key={palette.id} value={palette.id} className="min-h-11 px-3">
                    {palette.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              state.toggleComparison();
              if (state.isComparing) analytics.comparisonClosed();
              else analytics.comparisonOpened();
            }}
            aria-pressed={state.isComparing}
            aria-controls="palette-viewer"
            className="h-11 rounded-xl px-3 text-[#52664e] hover:bg-[#e9ede4] aria-pressed:bg-[#e9ede4]"
          >
            <ArrowLeftRight aria-hidden="true" />
            {state.isComparing ? "Завершить сравнение" : "Сравнить с оригиналом"}
          </Button>
        </div>
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)] lg:gap-8">
          <ComparisonViewer
            key={`${left.url}:${right.url}`}
            left={left}
            right={right}
            width={coloring.width}
            height={coloring.height}
            leftLabel={state.isComparing ? "Оригинал" : "Контур"}
            rightLabel={state.isComparing ? state.palette.label : "В цвете"}
            split={state.split}
            setSplit={state.setSplit}
            analytics={analytics}
          />
          <PaletteSection
            palette={state.palette}
            original={coloring.original}
            comparing={state.isComparing}
            themes={coloring.themes}
          />
        </div>
        <div className="mt-8 space-y-6 md:space-y-8">
          <ProductLinks
            album={coloring.collection.product}
            onAlbumClick={() => analytics.printAlbumClicked(coloring.collection.product.id)}
            onMaterialClick={analytics.materialProductClicked}
            material={"product" in state.palette ? state.palette.product : undefined}
            materialKind={"kind" in state.palette ? state.palette.kind : undefined}
          />
          {communityWorks}
          <aside className="max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950 sm:p-6">
            <h2 className="mb-2 text-base font-bold">О передаче цвета</h2>
            <p>
              Цвет на экране — ориентир. Итоговый оттенок зависит от бумаги, освещения, количества
              слоёв и настроек дисплея. Перед раскрашиванием попробуйте выбранные материалы на
              бумаге.
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}
