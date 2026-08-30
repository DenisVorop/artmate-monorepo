import type { ColoringRevision } from "@/entities/colorings";
import { Badge } from "@/shared/ui";

export function RevisionPalette({
  paletteColors,
}: {
  readonly paletteColors: ColoringRevision["paletteColors"];
}) {
  if (!paletteColors.length) {
    return (
      <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
        Для этой старой ревизии маркеры не назначены.
      </div>
    );
  }

  return (
    <section className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-medium">Назначения цветов</h4>
        <Badge variant="outline">{paletteColors.length} цветов</Badge>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        {[...paletteColors]
          .sort((left, right) => left.symbolPosition - right.symbolPosition)
          .map((color) => (
            <div
              className="grid min-w-0 grid-cols-[2rem_1fr] gap-2 rounded-lg border bg-muted/20 p-2"
              key={`${color.symbolPosition}-${color.markerColorId}`}
            >
              <div className="grid gap-1">
                <span className="flex size-8 items-center justify-center rounded-md bg-foreground font-mono text-xs font-semibold text-background">
                  {color.symbol}
                </span>
                <span
                  aria-label={`Цвет ${color.hex}`}
                  className="size-8 rounded-md border shadow-xs"
                  style={{ backgroundColor: color.hex }}
                />
              </div>
              <div className="min-w-0 self-center">
                <p className="truncate text-sm font-medium">
                  Маркер {color.markerNumber}
                </p>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {color.hex}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  Pantone {color.pantone}
                </p>
              </div>
            </div>
          ))}
      </div>
    </section>
  );
}
