"use client";

import { useEffect, useRef } from "react";

export function useWorksScroll({
  count,
  hasNextPage,
  isFetchingNextPage,
  isFetchNextPageError,
  paused,
  fetchNextPage,
}: {
  count: number;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  paused: boolean;
  fetchNextPage: () => Promise<unknown>;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const end = endRef.current;
    if (!end || !count || !hasNextPage || isFetchingNextPage || isFetchNextPageError || paused)
      return;
    let requested = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (requested || !entries.some((entry) => entry.isIntersecting)) return;
        requested = true;
        observer.disconnect();
        void fetchNextPage();
      },
      { rootMargin: "800px 0px" },
    );
    observer.observe(end);
    return () => {
      requested = true;
      observer.disconnect();
    };
  }, [count, hasNextPage, isFetchingNextPage, isFetchNextPageError, paused, fetchNextPage]);

  return endRef;
}
