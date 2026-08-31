"use client";

import { Blocks, ChevronDown, Search, SlidersHorizontal, Sparkles, Tags, X } from "lucide-react";
import { useDevelopmentBanner } from "@/entities/feature-banners";
import { useSession } from "@/entities/session";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  Input,
  Separator,
} from "@/shared/ui";
import { cn } from "@/shared/lib";
import { getQueryOwner } from "@/shared/lib/query-keys";
import { useCatalog } from "../lib/catalog-provider";
import { sortOptions, type SortValue } from "../lib/catalog-state";

export function Filters() {
  const { isPending, user } = useSession();
  const { hasDevelopmentBanner } = useDevelopmentBanner({
    enabled: !isPending,
    owner: getQueryOwner(user?.id),
  });
  const {
    categories,
    categoryId,
    query,
    onlyBestsellers,
    onlyPixel,
    setCategory,
    sortBy,
    setQuery,
    setOnlyBestsellers,
    setOnlyPixel,
    setSortBy,
  } = useCatalog();
  const sortLabel = sortOptions.find((option) => option.value === sortBy)?.label ?? "Сортировка";

  return (
    <div
      className={cn(
        "sticky z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
        hasDevelopmentBanner
          ? "top-[calc(var(--site-header-banner-height)+var(--site-header-nav-height)+1px)]"
          : "top-[var(--site-header-nav-height)]",
      )}
    >
      <div className="container grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2 py-2 sm:gap-x-3 sm:gap-y-3 sm:py-3 lg:flex lg:flex-row lg:items-center">
        <div className="relative min-w-0 lg:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск"
            className="pr-8 pl-8"
          />
          {query && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Очистить поиск"
              onClick={() => setQuery("")}
              className="absolute top-1/2 right-1.5 -translate-y-1/2"
            >
              <X />
            </Button>
          )}
        </div>

        <div className="flex justify-end lg:order-4 lg:ml-auto lg:flex-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={`Сортировка: ${sortLabel}`}
                className="w-8 justify-center p-0 sm:w-auto sm:min-w-36 sm:justify-between sm:px-2.5 lg:min-w-44"
              >
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <SlidersHorizontal data-icon="inline-start" />
                  <span className="hidden truncate sm:inline">{sortLabel}</span>
                </span>
                <ChevronDown data-icon="inline-end" className="hidden sm:block" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52">
              <DropdownMenuRadioGroup
                value={sortBy}
                onValueChange={(value) => setSortBy(value as SortValue)}
              >
                {sortOptions.map((option) => (
                  <DropdownMenuRadioItem key={option.value} value={option.value}>
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Separator orientation="vertical" className="hidden h-8 lg:order-1 lg:block" />

        <div className="col-span-2 -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 sm:gap-2 sm:pb-0 lg:order-2 lg:col-span-1 lg:flex-wrap lg:overflow-visible">
          {categories.length > 0 && (
            <>
              <Button
                type="button"
                variant={!categoryId ? "default" : "outline"}
                size="sm"
                aria-pressed={!categoryId}
                onClick={() => setCategory(undefined)}
                className="w-fit shrink-0"
              >
                <Tags data-icon="inline-start" />
                Все
              </Button>

              {categories.map((category) => {
                const isActive = category.id === categoryId;

                return (
                  <Button
                    type="button"
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    aria-pressed={isActive}
                    key={category.id}
                    onClick={() => setCategory(category.id)}
                    className="w-fit shrink-0"
                  >
                    {category.title}
                  </Button>
                );
              })}
              <Separator
                orientation="vertical"
                className="mx-1 h-7 self-center"
              />
            </>
          )}

          <Button
            type="button"
            variant={onlyBestsellers ? "default" : "outline"}
            size="sm"
            aria-pressed={onlyBestsellers}
            onClick={() => setOnlyBestsellers(!onlyBestsellers)}
            className={cn(
              "w-fit",
              onlyBestsellers &&
                "bg-rose-500 text-white hover:bg-rose-600 focus-visible:border-rose-300 focus-visible:ring-rose-400/30",
            )}
          >
            <Sparkles data-icon="inline-start" />
            Хит
          </Button>

          <Button
            type="button"
            variant={onlyPixel ? "default" : "outline"}
            size="sm"
            aria-pressed={onlyPixel}
            onClick={() => setOnlyPixel(!onlyPixel)}
            className={cn(
              "w-fit",
              onlyPixel &&
                "bg-stone-900 text-white hover:bg-stone-800 focus-visible:border-stone-400 focus-visible:ring-stone-500/30",
            )}
          >
            <Blocks data-icon="inline-start" />
            Пиксельная
          </Button>
        </div>
      </div>
    </div>
  );
}
