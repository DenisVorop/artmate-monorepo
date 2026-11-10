"use client";

import { useAnalytics } from "../lib/analytics";
import { X } from "lucide-react";
import { Button } from "@/shared/ui";
import { useCatalog } from "../lib/catalog-provider";

export function Summary() {
  const analytics = useAnalytics();
  const {
    onlyBestsellers,
    onlyAvailable,
    minPrice,
    maxPrice,
    selectedTags,
    hasFilters,
    countLabel,
    updateFilters,
    toggleTag,
    clearFilters,
  } = useCatalog();
  const chips = [
    ...(minPrice !== undefined
      ? [
          {
            label: `От ${minPrice.toLocaleString("ru-RU")} ₽`,
            kind: "minimum_price" as const,
            remove: () => updateFilters({ minPrice: undefined }),
          },
        ]
      : []),
    ...(maxPrice !== undefined
      ? [
          {
            label: `До ${maxPrice.toLocaleString("ru-RU")} ₽`,
            kind: "maximum_price" as const,
            remove: () => updateFilters({ maxPrice: undefined }),
          },
        ]
      : []),
    ...(onlyAvailable
      ? [
          {
            label: "В наличии",
            kind: "availability" as const,
            remove: () => updateFilters({ onlyAvailable: false }),
          },
        ]
      : []),
    ...(onlyBestsellers
      ? [
          {
            label: "Хиты",
            kind: "bestsellers" as const,
            remove: () => updateFilters({ onlyBestsellers: false }),
          },
        ]
      : []),
    ...selectedTags.map((tag) => ({
      label: tag.title,
      kind: "tag" as const,
      remove: () => toggleTag(tag.slug),
    })),
  ];
  return (
    <div className="mb-5 space-y-3">
      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
        {countLabel}
      </p>
      {hasFilters && (
        <div className="flex flex-wrap items-center gap-2" aria-label="Выбранные фильтры">
          {chips.map((chip) => (
            <Button
              key={chip.label}
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                analytics.filterRemoved(chip.kind);
                chip.remove();
              }}
              aria-label={`Убрать фильтр: ${chip.label}`}
              className="h-auto min-h-8 max-w-full gap-2 py-1.5 text-left whitespace-normal"
            >
              <span>{chip.label}</span>
              <X className="size-3.5" />
            </Button>
          ))}
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={() => {
              analytics.filtersReset();
              clearFilters();
            }}
            className="text-muted-foreground"
          >
            Сбросить фильтры
          </Button>
        </div>
      )}
    </div>
  );
}
