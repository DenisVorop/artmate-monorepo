"use client";

import { useEffect, useRef } from "react";

type WorksScrollOptions = {
  count: number;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  fetchNextPage: () => Promise<unknown>;
};

export function useWorksScroll({
  count,
  hasNextPage,
  isFetchingNextPage,
  isFetchNextPageError,
  fetchNextPage,
}: WorksScrollOptions) {
  const trackRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!count || !hasNextPage || isFetchingNextPage || isFetchNextPageError) return;
    const root = trackRef.current;
    const end = endRef.current;
    if (!root || !end) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void fetchNextPage();
      },
      { root, rootMargin: "0px 160px 0px 0px" },
    );
    observer.observe(end);
    return () => observer.disconnect();
  }, [count, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage]);

  return { trackRef, endRef };
}
