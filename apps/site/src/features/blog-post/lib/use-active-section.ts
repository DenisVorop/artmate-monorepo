"use client";

import { useEffect, useState } from "react";

export type TocItem = { id: string; label: string; level: 2 | 3 };

function getReadingOffset() {
  const header = document.querySelector("header")?.getBoundingClientRect().bottom ?? 72;
  const contents =
    document.querySelector("[data-mobile-article-contents]")?.getBoundingClientRect().height ?? 0;
  return header + contents;
}

export function useActiveSection(items: TocItem[]) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? "");

  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const offset = getReadingOffset() + 44;
        let current = items[0]?.id ?? "";
        for (const item of items) {
          const heading = document.getElementById(item.id);
          if (heading && heading.getBoundingClientRect().top <= offset) current = item.id;
        }
        setActiveId(current);
      });
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [items]);

  function scrollToSection(id: string) {
    const heading = document.getElementById(id);
    if (!heading) return;
    const offset = getReadingOffset() + 24;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.history.replaceState(window.history.state, "", `#${encodeURIComponent(id)}`);
    setActiveId(id);
    window.scrollTo({
      top: window.scrollY + heading.getBoundingClientRect().top - offset,
      behavior: reducedMotion ? "instant" : "smooth",
    });
  }

  return { activeId, scrollToSection };
}
