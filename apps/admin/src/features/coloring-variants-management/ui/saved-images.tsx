import type { ColoringVariants } from "@/entities/coloring-variants";
import { Badge } from "@/shared/ui";

import { symbols } from "../lib/form-values";
import { variantStatusLabels } from "../lib/publication-values";
import { ProtectedImage } from "./protected-image";
import { PublishButton } from "./publish-button";

export function SavedImages({
  state,
  disabled = false,
}: {
  readonly state: ColoringVariants;
  readonly disabled?: boolean;
}) {
  if (!state.original)
    return (
      <p className="text-sm text-muted-foreground">Оригинал ещё не загружен.</p>
    );
  const images = [
    { id: "original", title: "Оригинал", ...state.original },
    ...state.variants.map((variant) => ({
      id: variant.materialSetId,
      ...variant,
    })),
  ];
  return (
    <section className="grid gap-5" aria-label="Сохранённые изображения">
      <h3 className="font-semibold">Сохранённые изображения</h3>
      {state.outlineUrl && (
        <div className="max-w-sm">
          <ProtectedImage url={state.outlineUrl} label="Общие контуры" />
        </div>
      )}
      {images.map((item) => (
        <article key={item.id} className="grid gap-3 rounded-lg border p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-medium">{item.title}</h4>
            <Badge
              variant={item.status === "published" ? "default" : "secondary"}
            >
              {variantStatusLabels[item.status]}
            </Badge>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <ProtectedImage url={item.imageUrl} label="Цветной образец" />
            <ProtectedImage url={item.cardUrl} label="Миниатюра" />
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Палитра">
            {item.palette.map((color) => (
              <Badge
                key={color.symbolPosition}
                variant="outline"
                className="gap-2"
              >
                <span
                  aria-hidden="true"
                  className="size-4 rounded border"
                  style={{ backgroundColor: color.hex }}
                />
                {symbols[color.symbolPosition - 1]} —{" "}
                {"code" in color ? String(color.code) : color.hex}
              </Badge>
            ))}
          </div>
          <PublishButton
            key={`${item.id}-${state.token}`}
            state={state}
            target={item.id}
            title={item.title}
            imageUrl={item.imageUrl}
            disabled={disabled}
          />
        </article>
      ))}
    </section>
  );
}
