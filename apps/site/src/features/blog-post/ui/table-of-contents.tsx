"use client";

import { cn } from "@/shared/lib";
import { Button } from "@/shared/ui";
import { useActiveSection, type TocItem } from "../lib/use-active-section";

type TableOfContentsProps = {
  items: TocItem[];
  onNavigate?: () => void;
};

export function TableOfContents({ items, onNavigate }: TableOfContentsProps) {
  const { activeId, scrollToSection } = useActiveSection(items);

  return (
    <nav aria-label="Содержание статьи" className="space-y-1">
      {items.map((item) => (
        <Button
          key={item.id}
          asChild
          variant={activeId === item.id ? "secondary" : "ghost"}
          size="sm"
          className={cn(
            "h-auto w-full justify-start px-3 py-2 text-left whitespace-normal",
            activeId === item.id && "shadow-none",
            item.level === 3 && "pl-6 text-[13px]",
          )}
        >
          <a
            href={`#${item.id}`}
            aria-current={activeId === item.id ? "location" : undefined}
            onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              if (onNavigate) {
                onNavigate();
                requestAnimationFrame(() => scrollToSection(item.id));
              } else {
                scrollToSection(item.id);
              }
            }}
          >
            <span>{item.label}</span>
          </a>
        </Button>
      ))}
    </nav>
  );
}
