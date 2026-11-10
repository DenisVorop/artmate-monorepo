"use client";

import { ChevronDown, Search, X } from "lucide-react";
import { useRef } from "react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  Input,
} from "@/shared/ui";
import { useCatalog } from "../lib/catalog-provider";
import { sortOptions } from "../lib/catalog-state";
import { useAnalytics } from "../lib/analytics";

export function Toolbar() {
  const analytics = useAnalytics();
  const { activeCategory, query, setQuery, sortBy, updateFilters } = useCatalog();
  const inputRef = useRef<HTMLInputElement>(null);
  const sortLabel = sortOptions.find((option) => option.value === sortBy)?.label;
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3">
      <div className="relative min-w-0 flex-[1_1_14rem]">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => {
            const value = event.target.value;
            if (!query.trim() && value.trim()) analytics.searchStarted();
            if (query && !value) analytics.searchCleared();
            setQuery(value);
          }}
          placeholder={activeCategory ? "Поиск в категории" : "Найти товар"}
          aria-label={
            activeCategory ? `Поиск в категории «${activeCategory.title}»` : "Поиск по каталогу"
          }
          className="h-10 pr-10 pl-9 [&::-webkit-search-cancel-button]:appearance-none"
        />
        {query && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Очистить поиск"
            onClick={() => {
              analytics.searchCleared();
              setQuery("");
              inputRef.current?.focus();
            }}
            className="absolute top-1/2 right-1.5 -translate-y-1/2"
          >
            <X />
          </Button>
        )}
      </div>
      <DropdownMenu
        onOpenChange={(open) => (open ? analytics.sortOpened() : analytics.sortClosed())}
      >
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="ml-auto h-10 min-w-44 justify-between"
            aria-label={`Сортировка: ${sortLabel}`}
          >
            <span>{sortLabel}</span>
            <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          <DropdownMenuRadioGroup
            value={sortBy}
            onValueChange={(value) => {
              const nextSort = sortOptions.find((option) => option.value === value)?.value;
              if (!nextSort || nextSort === sortBy) return;
              analytics.sortChanged(nextSort);
              updateFilters({ sortBy: nextSort });
            }}
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
  );
}
