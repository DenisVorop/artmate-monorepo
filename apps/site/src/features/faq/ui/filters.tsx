import { Search, X } from "lucide-react";

import { Button, Input, cn } from "@/shared";
import { faqSections } from "../lib";

type FiltersProps = {
  query: string;
  activeSectionId: string | null;
  onQueryChange(_value: string): void;
  onSectionChange(_sectionId: string | null): void;
};

export function Filters({ query, activeSectionId, onQueryChange, onSectionChange }: FiltersProps) {
  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Поиск по вопросам"
          className="h-11 pr-10 pl-9"
        />
        {query && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Очистить поиск"
            onClick={() => onQueryChange("")}
            className="absolute top-1/2 right-2 -translate-y-1/2"
          >
            <X />
          </Button>
        )}
      </div>

      {!query && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
          <Button
            type="button"
            size="sm"
            variant={activeSectionId ? "outline" : "default"}
            aria-pressed={!activeSectionId}
            onClick={() => onSectionChange(null)}
          >
            Все разделы
          </Button>

          {faqSections.map((section) => {
            const selected = activeSectionId === section.id;
            const Icon = section.icon;

            return (
              <Button
                key={section.id}
                type="button"
                size="sm"
                variant={selected ? "default" : "outline"}
                aria-pressed={selected}
                onClick={() => onSectionChange(selected ? null : section.id)}
                className={cn(selected && "bg-foreground text-background hover:bg-foreground/90")}
              >
                <Icon data-icon="inline-start" />
                {section.label}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}
