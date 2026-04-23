import { Search, X } from "lucide-react";

import { Button, Input, Separator } from "@/shared";
import { allBlogCategories } from "../lib";

type FiltersProps = {
  query: string;
  category: string;
  onQueryChange(_value: string): void;
  onCategoryChange(_category: string): void;
};

export function Filters({ query, category, onQueryChange, onCategoryChange }: FiltersProps) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="relative lg:max-w-sm lg:flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={"Поиск по\u00a0статьям"}
          className="pr-8 pl-8"
        />
        {query && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Очистить поиск"
            onClick={() => onQueryChange("")}
            className="absolute top-1/2 right-1.5 -translate-y-1/2"
          >
            <X />
          </Button>
        )}
      </div>

      <Separator orientation="vertical" className="hidden h-8 lg:block" />

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0 lg:justify-end">
        {allBlogCategories.map((item) => (
          <Button
            key={item}
            type="button"
            variant={category === item ? "default" : "outline"}
            aria-pressed={category === item}
            onClick={() => onCategoryChange(item)}
          >
            {item}
          </Button>
        ))}
      </div>
    </div>
  );
}
