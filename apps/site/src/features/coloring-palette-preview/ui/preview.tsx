"use client";

import { ArrowLeft, ArrowLeftRight, ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { routes } from "@/shared/constants/routes";
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui";

import { previewPalettes, sampleImages } from "../lib/sample";
import { usePreviewState } from "../lib/use-preview-state";
import { Palette } from "./palette";
import { ProductLinks } from "./product-links";
import { Viewer } from "./viewer";

export function ColoringPalettePreview({ communityWorks }: { communityWorks: ReactNode }) {
  const state = usePreviewState();
  const selectedPalette = previewPalettes[state.palette];

  return (
    <div className="min-h-dvh bg-[radial-gradient(circle_at_top_left,rgba(251,113,133,0.09),transparent_34rem)] text-stone-900">
      <header className="border-b border-stone-200/70 bg-white/70">
        <div className="mx-auto flex h-20 max-w-[1240px] items-center justify-between gap-5 px-5 sm:px-8">
          <Link href={routes.home} aria-label="Artmate — главная">
            <Image
              src="/brand/artmate-logo.svg"
              alt="Artmate"
              width={108}
              height={52}
              unoptimized
              className="h-12 w-24 object-contain"
            />
          </Link>
          <span className="text-xs text-stone-500">Пример нового просмотра</span>
        </div>
      </header>

      <main className="container pt-5 pb-12 md:pt-8 md:pb-16">
        <nav
          aria-label="Навигация по раскраскам"
          className="mb-5 flex items-center gap-2 text-sm text-stone-500"
        >
          <Link
            href={routes.coloringCollection("cifrovaya-raskraska-sobachki")}
            className="inline-flex min-h-10 items-center gap-2 hover:text-stone-950"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Собачки
          </Link>
          <ChevronRight className="size-3" aria-hidden="true" />
          <span aria-current="page">Картина 1</span>
        </nav>
        <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1 className="font-heading text-2xl leading-snug font-bold tracking-tight sm:text-3xl">
              Картина 1
            </h1>
            <p className="mt-2 text-sm text-stone-500">Корги среди тюльпанов · Собачки</p>
          </div>
        </div>

        <div className="mb-7 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-y border-stone-200/80 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="preview-palette" className="text-sm font-semibold">
              Палитра
            </label>
            <Select value={state.palette} onValueChange={state.selectPalette}>
              <SelectTrigger
                id="preview-palette"
                size="lg"
                className="min-w-[210px] rounded-xl border-stone-200 bg-white px-4 font-semibold"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" className="p-1.5">
                {Object.entries(previewPalettes).map(([value, palette]) => (
                  <SelectItem key={value} value={value} className="min-h-11 px-3">
                    {palette.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="ghost"
            onClick={state.toggleComparison}
            aria-pressed={state.isComparing}
            aria-controls="palette-viewer"
            className="h-11 rounded-xl px-3 text-[#52664e] hover:bg-[#e9ede4] aria-pressed:bg-[#e9ede4]"
          >
            <ArrowLeftRight aria-hidden="true" />
            {state.isComparing ? "Завершить сравнение" : "Сравнить с оригиналом"}
          </Button>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)] lg:gap-8">
          <Viewer
            left={state.isComparing ? sampleImages.original : sampleImages.outline}
            right={selectedPalette.image}
            leftLabel={state.isComparing ? "Оригинал" : "Контур"}
            rightLabel={state.isComparing ? selectedPalette.label : "В цвете"}
            label={
              state.isComparing
                ? `Сравнение: оригинал и ${selectedPalette.label}`
                : "Соотношение контура и цветной версии"
            }
            split={state.split}
            setSplit={state.setSplit}
          />
          <Palette choice={state.palette} comparing={state.isComparing} />
        </div>

        <div className="mt-8 space-y-6 md:space-y-8">
          <ProductLinks />
          {communityWorks}
          <aside className="max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950 sm:p-6">
            <h2 className="mb-2 text-base font-bold">О передаче цвета</h2>
            <p>
              Цвет на экране — ориентир. Итоговый оттенок зависит от бумаги, освещения, количества
              слоёв и настроек дисплея. Для выбора используйте физическую выкраску Artmate.
            </p>
          </aside>
        </div>

        <footer className="mt-10 border-t border-stone-200/80 pt-5 text-xs leading-5 text-stone-500">
          Макет интерфейса. Иллюстрация — из альбома «Собачки»; подбор маркеров демонстрационный, не
          для раскрашивания печатного альбома.
        </footer>
      </main>
    </div>
  );
}
