"use client";

import { useEffect, useState } from "react";

import { Button, cn } from "@/shared";

type TocItem = {
  id: string;
  label: string;
};

type TableOfContentsProps = {
  items: TocItem[];
};

export function TableOfContents({ items }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? "");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries.find((entry) => entry.isIntersecting);

        if (visibleEntry) {
          setActiveId(visibleEntry.target.id);
        }
      },
      { rootMargin: "-18% 0% -60% 0%" },
    );

    items.forEach(({ id }) => {
      const element = document.getElementById(id);

      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, [items]);

  function scrollToSection(id: string) {
    const element = document.getElementById(id);

    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  return (
    <nav aria-label="Содержание статьи" className="space-y-1">
      {items.map((item) => (
        <Button
          key={item.id}
          type="button"
          variant={activeId === item.id ? "secondary" : "ghost"}
          size="sm"
          onClick={() => scrollToSection(item.id)}
          className={cn(
            "h-auto w-full justify-start px-3 py-2 text-left whitespace-normal",
            activeId === item.id && "shadow-none",
          )}
        >
          <span>{item.label}</span>
        </Button>
      ))}
    </nav>
  );
}
