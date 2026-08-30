import { Palette } from "lucide-react";

import type { Coloring } from "@/entities/coloring";
import { Badge, Card, CardContent, CardDescription, CardTitle } from "@/shared/ui";

type PaletteSectionProps = {
  palette: Coloring["palette"];
  themes: Coloring["themes"];
};

export function PaletteSection({ palette, themes }: PaletteSectionProps) {
  return (
    <section aria-labelledby="coloring-palette-title">
      <Card className="rounded-2xl border-0 bg-stone-950 py-5 text-white ring-stone-950/10 sm:py-6">
        <CardContent className="space-y-5 px-4 sm:px-6 lg:px-8">
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
                Палитра Artmate
              </CardTitle>
              <CardDescription className="mt-1 text-stone-300">
                {palette.colors.length > 0
                  ? `Использовано ${palette.colors.length} из 168 оттенков Artmate`
                  : "Палитра для этой иллюстрации пока не указана"}
              </CardDescription>
            </div>
          </div>

          {palette.colors.length > 0 ? (
            <ul
              className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
              aria-label="Цвета и номера маркеров"
            >
              {palette.colors.map((color) => (
                <li
                  key={color.symbolPosition}
                  className="flex min-w-0 items-center gap-2 rounded-xl bg-white/6 p-3 ring-1 ring-white/10 sm:p-4 md:gap-3"
                >
                  <span
                    aria-hidden="true"
                    className="size-10 shrink-0 rounded-full ring-1 ring-white/20 md:size-12"
                    style={{ backgroundColor: color.hex }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <p className="shrink-0 text-lg whitespace-nowrap text-stone-300">
                        № {color.symbol}
                      </p>
                      <div className="flex items-baseline gap-x-2 whitespace-nowrap">
                        <span className="text-xl font-medium text-stone-200">Маркер</span>
                        <strong className="text-3xl font-semibold tracking-tight text-white tabular-nums">
                          {color.markerNumber}
                        </strong>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-xs text-stone-400">
                      <code className="font-mono">{color.hex}</code>
                      <span>Pantone {color.pantone}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl bg-white/6 px-4 py-3 text-sm leading-6 text-stone-300 ring-1 ring-white/10">
              Данные о маркерах появятся после настройки палитры для этой картины.
            </p>
          )}

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
