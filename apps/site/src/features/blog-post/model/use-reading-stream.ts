"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { blogQuery } from "@/entities/blog";
import type { BlogPostPageDataDTO } from "@/shared/actions/blog";
import { blogPostPageQuery } from "./query";
import { nextReadingPost } from "../lib/reading-stream";

export function useReadingStream(initial: BlogPostPageDataDTO) {
  const queryClient = useQueryClient();
  const [pages, setPages] = useState([initial]);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "done">("idle");
  const sentinelRef = useRef<HTMLDivElement>(null);
  const inFlight = useRef(false);
  const latestPages = useRef(pages);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadNext = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setStatus("loading");
    try {
      const current = latestPages.current;
      const last = current[current.length - 1]!;
      const allPosts = await queryClient.fetchQuery(blogQuery.getPosts());
      if (!allPosts) throw new Error("Blog posts unavailable");
      const loaded = current.flatMap((page) => (page.post ? [page.post.slug] : []));
      const candidate = nextReadingPost(last.relatedPosts, allPosts.items, loaded);
      if (!candidate) {
        if (mounted.current) setStatus("done");
        return;
      }
      const next = await queryClient.fetchQuery(blogPostPageQuery(candidate.slug));
      if (!next.post || !next.content) throw new Error("Article unavailable");
      if (mounted.current) {
        latestPages.current = [...current, next];
        setPages(latestPages.current);
        setStatus("idle");
      }
    } catch {
      if (mounted.current) setStatus("error");
    } finally {
      inFlight.current = false;
    }
  }, [queryClient]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || status !== "idle") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadNext();
      },
      { rootMargin: "1000px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadNext, pages.length, status]);

  return { pages, status, sentinelRef, loadNext };
}
