"use client";

import { X } from "lucide-react";
import { Badge, Button } from "@/shared/ui";
import { useCatalog } from "../lib/catalog-provider";

export function Summary() {
  const {
    activeCategory,
    query,
    onlyBestsellers,
    onlyPixel,
    hasFilters,
    countLabel,
    clearCategory,
    clearQuery,
    clearBestsellers,
    clearPixel,
    clearAll,
  } = useCatalog();

  return (
    <div className="mb-4 flex min-h-7 flex-col justify-between gap-4 sm:flex-row sm:items-start">
      <div className="flex min-h-7 flex-col gap-3 sm:flex-row sm:items-center">
        <p className="flex min-h-7 items-center text-sm text-muted-foreground">
          {countLabel}
        </p>

        <div className="flex min-h-7 flex-wrap items-center gap-2">
          {activeCategory && (
            <Badge variant="secondary" className="h-auto py-1 pr-1">
              {activeCategory.title}
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label={`Убрать категорию ${activeCategory.title}`}
                onClick={clearCategory}
                className="size-4 rounded-full"
              >
                <X />
              </Button>
            </Badge>
          )}

          {onlyBestsellers && (
            <Badge className="h-auto bg-rose-500 py-1 pr-1 text-white hover:bg-rose-500">
              Хит
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label="Убрать фильтр хитов"
                onClick={clearBestsellers}
                className="size-4 rounded-full text-white hover:bg-white/15 hover:text-white"
              >
                <X />
              </Button>
            </Badge>
          )}

          {onlyPixel && (
            <Badge className="h-auto bg-stone-900 py-1 pr-1 text-white hover:bg-stone-900">
              Пиксельная
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label="Убрать фильтр пиксельных раскрасок"
                onClick={clearPixel}
                className="size-4 rounded-full text-white hover:bg-white/15 hover:text-white"
              >
                <X />
              </Button>
            </Badge>
          )}

          {query.trim() && (
            <Badge variant="outline" className="h-auto py-1 pr-1">
              {`"${query.trim()}"`}
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label="Очистить поиск"
                onClick={clearQuery}
                className="size-4 rounded-full"
              >
                <X />
              </Button>
            </Badge>
          )}
        </div>
      </div>

      {hasFilters && (
        <Button type="button" variant="link" size="sm" onClick={clearAll} className="w-fit px-0">
          Сбросить всё
        </Button>
      )}
    </div>
  );
}
