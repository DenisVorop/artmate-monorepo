import { ArrowRight, Palette } from "lucide-react";

import type { Coloring } from "@/entities/coloring-variants";
import { Badge, Card, CardContent, CardDescription, CardTitle } from "@/shared/ui";

type PaletteSectionProps = {
  palette: Coloring["original"] | Coloring["variants"][number];
  original: Coloring["original"];
  comparing: boolean;
  themes: Coloring["themes"];
};

const materialLabels = { MARKER: "Маркер", PENCIL: "Карандаш", PAINT: "Краска", OTHER: "Цвет" };

export function PaletteSection({ palette, original, comparing, themes }: PaletteSectionProps) {
  const material = "kind" in palette ? materialLabels[palette.kind] : undefined;

  return (
    <section className="min-w-0" aria-labelledby="coloring-palette-title">
      <Card className="rounded-2xl border-0 bg-stone-950 py-5 text-white ring-stone-950/10 sm:py-6">
        <CardContent className="space-y-5 px-4 sm:px-6 lg:px-4">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-rose-400 text-stone-950">
              <Palette className="size-5" aria-hidden="true" />
            </span>
            <div>
              <CardTitle
                id="coloring-palette-title"
                role="heading"
                aria-level={2}
                className="text-lg text-white"
              >
                {comparing ? `Оригинал и ${palette.label}` : palette.label}
              </CardTitle>
              <CardDescription className="mt-1 text-stone-300">
                {"totalColors" in palette
                  ? `Использовано ${palette.colors.length} из ${palette.totalColors} оттенков`
                  : `${palette.colors.length} оттенков`}
              </CardDescription>
            </div>
          </div>
          <p className="text-sm leading-6 text-stone-300" aria-live="polite">
            {comparing
              ? palette.id === "original"
                ? "С обеих сторон — оригинал, поэтому цвета совпадают."
                : "Слева — исходный цвет, справа — цвет выбранной палитры. Обозначения на рисунке не меняются."
              : material
                ? "Найдите обозначение на рисунке и возьмите цвет с указанным кодом."
                : "Исходные цвета иллюстрации. Подберите похожие оттенки из своих материалов."}
          </p>
          <ol
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-2"
            aria-label={comparing ? "Сравнение цветов" : palette.label}
          >
            {palette.colors.map((color) => {
              const originalColor = original.colors.find(
                (item) => item.symbolPosition === color.symbolPosition,
              );
              return (
                <li
                  key={color.symbolPosition}
                  className="flex min-w-0 items-center gap-2 rounded-xl bg-white/6 p-3 ring-1 ring-white/10 sm:p-4 md:gap-3 lg:gap-2 lg:p-2.5"
                >
                  <span className="flex shrink-0 items-center gap-1" aria-hidden="true">
                    {comparing && originalColor && (
                      <>
                        <span
                          className="size-8 shrink-0 rounded-full ring-1 ring-white/20 lg:size-6"
                          style={{ backgroundColor: originalColor.hex }}
                        />
                        <ArrowRight className="size-3 shrink-0 text-stone-300" />
                      </>
                    )}
                    <span
                      className={
                        comparing
                          ? "size-8 shrink-0 rounded-full ring-1 ring-white/20 lg:size-6"
                          : "size-10 shrink-0 rounded-full ring-1 ring-white/20 md:size-12 lg:size-8"
                      }
                      style={{ backgroundColor: color.hex }}
                    />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-1 lg:flex-col lg:gap-y-0">
                    <span className="shrink-0 text-lg whitespace-nowrap text-stone-300 lg:text-sm">
                      № {color.symbol}
                    </span>
                    {"code" in color && (
                      <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 lg:gap-x-1">
                        <span className="text-xl font-medium text-stone-200 lg:text-xs">
                          {material}
                        </span>
                        <strong className="text-3xl font-semibold tracking-tight break-all text-white tabular-nums lg:text-xl">
                          {color.code}
                        </strong>
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="flex flex-wrap gap-2">
            {themes.map((theme) => (
              <Badge key={theme.id} variant="outline" className="border-white/20 text-white">
                {theme.title}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
