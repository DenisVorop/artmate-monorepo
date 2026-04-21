"use client";

import { ChevronDown, Search, SlidersHorizontal, Sparkles, X } from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  Input,
  Separator,
  cn,
} from "@/shared";
import { useCatalog } from "../lib/catalog-provider";
import { sortOptions, type SortValue } from "../lib/catalog-state";

export function Filters() {
  const {
    categories,
    categoryId,
    query,
    onlyBestsellers,
    sortBy,
    setQuery,
    setCategory,
    setOnlyBestsellers,
    setSortBy,
  } = useCatalog();
  const sortLabel = sortOptions.find((option) => option.value === sortBy)?.label ?? "Сортировка";

  return (
    <div className="sticky top-[69px] z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container flex flex-col gap-3 py-3 lg:flex-row lg:items-center">
        <div className="relative w-full sm:w-64">
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

        <Separator orientation="vertical" className="hidden h-6 lg:block" />

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
          <Button
            type="button"
            size="sm"
            variant={categoryId ? "ghost" : "default"}
            aria-pressed={!categoryId}
            onClick={() => setCategory(undefined)}
          >
            Все
          </Button>
          {categories.map((category) => (
            <Button
              key={category.id}
              type="button"
              size="sm"
              variant={categoryId === category.id ? "default" : "ghost"}
              aria-pressed={categoryId === category.id}
              onClick={() => setCategory(categoryId === category.id ? undefined : category.id)}
            >
              {category.title}
            </Button>
          ))}
        </div>

        <Separator orientation="vertical" className="hidden h-6 lg:block" />

        <Button
          type="button"
          size="sm"
          variant={onlyBestsellers ? "default" : "outline"}
          aria-pressed={onlyBestsellers}
          onClick={() => setOnlyBestsellers(!onlyBestsellers)}
          className={cn(
            "w-fit",
            onlyBestsellers &&
              "bg-rose-500 text-white hover:bg-rose-600 focus-visible:border-rose-300 focus-visible:ring-rose-400/30",
          )}
        >
          <Sparkles data-icon="inline-start" />
          Хиты
        </Button>

        <div className="flex flex-1 justify-start lg:justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-w-44 justify-between"
              >
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <SlidersHorizontal data-icon="inline-start" />
                  <span className="truncate">{sortLabel}</span>
                </span>
                <ChevronDown data-icon="inline-end" />
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
      </div>
    </div>
  );
}
