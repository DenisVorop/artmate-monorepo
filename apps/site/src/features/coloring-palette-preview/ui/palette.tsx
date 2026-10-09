import { ArrowRight, Palette as PaletteIcon } from "lucide-react";

import { Badge, Card, CardContent, CardDescription, CardTitle } from "@/shared/ui";

import { previewPalettes, type PreviewPalette, type PaletteChoice } from "../lib/sample";

export function Palette({ choice, comparing }: { choice: PaletteChoice; comparing: boolean }) {
  const palette: PreviewPalette = previewPalettes[choice];
  const showMarkers = palette.colors.some((color) => color.marker);

  return (
    <section className="min-w-0" aria-labelledby="palette-heading">
      <Card className="rounded-2xl border-0 bg-stone-950 py-5 text-white ring-stone-950/10 sm:py-6">
        <CardContent className="space-y-5 px-4 sm:px-6 lg:px-4">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-rose-400 text-stone-950">
              <PaletteIcon className="size-5" aria-hidden="true" />
            </span>
            <div>
              <CardTitle
                id="palette-heading"
                role="heading"
                aria-level={2}
                className="text-lg text-white"
              >
                {comparing ? `Оригинал и ${palette.label}` : palette.title}
              </CardTitle>
              <CardDescription className="mt-1 text-stone-300">
                {palette.totalColors
                  ? `Использовано ${palette.colors.length} из ${palette.totalColors} оттенков`
                  : `${palette.colors.length} оттенков`}
              </CardDescription>
            </div>
          </div>
          <div className="text-sm leading-6 text-stone-300" aria-live="polite">
            {comparing ? (
              <p>
                {choice === "original"
                  ? "С обеих сторон — оригинал, поэтому цвета совпадают."
                  : "Слева — исходный цвет, справа — цвет выбранной палитры. Номера на рисунке не меняются."}
              </p>
            ) : showMarkers ? (
              <p>Найдите обозначение на рисунке и возьмите маркер с указанным номером.</p>
            ) : (
              <p>Исходные цвета иллюстрации. Подберите похожие оттенки из своих материалов.</p>
            )}
          </div>
          <ol
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-2"
            aria-label={comparing ? "Сравнение цветов" : palette.label}
          >
            {palette.colors.map((color) => (
              <li
                key={color.symbol}
                className="flex min-w-0 items-center gap-2 rounded-xl bg-white/6 p-3 ring-1 ring-white/10 sm:p-4 md:gap-3 lg:gap-2 lg:p-2.5"
              >
                <span className="flex shrink-0 items-center gap-1" aria-hidden="true">
                  {comparing && (
                    <span
                      className="size-8 shrink-0 rounded-full ring-1 ring-white/20 lg:size-6"
                      style={{ backgroundColor: color.original }}
                    />
                  )}
                  {comparing && <ArrowRight className="size-3 shrink-0 text-stone-300" />}
                  <span
                    className={
                      comparing
                        ? "size-8 shrink-0 rounded-full ring-1 ring-white/20 lg:size-6"
                        : "size-10 shrink-0 rounded-full ring-1 ring-white/20 md:size-12 lg:size-8"
                    }
                    style={{ backgroundColor: color.hex }}
                  />
                </span>
                <div
                  aria-hidden="true"
                  className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-1 lg:flex-col lg:gap-y-0"
                >
                  <span className="shrink-0 text-lg whitespace-nowrap text-stone-300 lg:text-sm">
                    № {color.symbol}
                  </span>
                  {color.marker && (
                    <span className="flex items-baseline gap-x-2 whitespace-nowrap lg:gap-x-1">
                      <span className="text-xl font-medium text-stone-200 lg:text-xs">Маркер</span>
                      <strong className="text-3xl font-semibold tracking-tight text-white tabular-nums lg:text-xl">
                        {color.marker}
                      </strong>
                    </span>
                  )}
                </div>
                <span className="sr-only">
                  {color.marker
                    ? `Обозначение ${color.symbol}, маркер ${color.marker}`
                    : `Цвет для обозначения ${color.symbol}`}
                </span>
              </li>
            ))}
          </ol>
          <Badge variant="outline" className="border-white/20 text-white">
            Собачки
          </Badge>
          <p className="text-xs leading-5 text-stone-400">
            Цвет на экране — ориентир. Перед раскрашиванием попробуйте маркер на бумаге.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
