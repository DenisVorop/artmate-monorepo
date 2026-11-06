"use client";

import { useEffect, useRef } from "react";

export function useReadingLayout() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const header = document.querySelector("header");
    if (!header) return;

    const updateOffset = () => {
      ref.current?.style.setProperty(
        "--article-sticky-top",
        `${header.getBoundingClientRect().height}px`,
      );
    };

    updateOffset();
    const observer = new ResizeObserver(updateOffset);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  return ref;
}
