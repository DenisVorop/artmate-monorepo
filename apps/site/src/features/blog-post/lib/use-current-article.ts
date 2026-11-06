"use client";

import { useEffect, useRef, useState } from "react";
import type { BlogPost } from "@/entities/blog";
import { routes } from "@/shared/constants";
import { virtualPageViewState } from "@/shared/lib/analytics";
import { articleElementId, readingIndex } from "./reading-stream";

export function useCurrentArticle(posts: BlogPost[]) {
  const [activeSlug, setActiveSlug] = useState(posts[0]!.slug);
  const active = useRef(posts[0]!.slug);
  const visited = useRef(new Set([posts[0]!.slug]));
  const feed = posts[0]!.slug;

  useEffect(() => {
    let frame = 0;
    let lastScroll = window.scrollY;
    let lastSavedAt = Date.now();
    const previousRestoration = history.scrollRestoration;
    history.scrollRestoration = "manual";
    const savePosition = (slug: string, scrollY: number, silent = false) => {
      lastSavedAt = Date.now();
      history.replaceState(
        {
          ...history.state,
          blogReading: { feed, slug, scrollY },
          ...(silent ? virtualPageViewState(window.location.href, false) : {}),
        },
        "",
      );
    };
    savePosition(active.current, lastScroll);

    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (document.visibilityState === "hidden") return;
        const header = document.querySelector("header")?.getBoundingClientRect().bottom ?? 72;
        const readingLine = header + Math.min((window.innerHeight - header) * 0.35, 240);
        const starts = posts.map(
          (post) =>
            document.getElementById(articleElementId(post.slug))?.getBoundingClientRect().top ??
            Infinity,
        );
        const index = readingIndex(starts, readingLine);
        const post = posts[index]!;
        if (post.slug !== active.current) {
          // Preserve the preceding reading position before adding a history entry.
          const previousIndex = posts.findIndex((candidate) => candidate.slug === active.current);
          const previousPosition =
            index > previousIndex
              ? Math.min(
                  lastScroll,
                  Math.max(window.scrollY + starts[index]! - readingLine - 80, 0),
                )
              : lastScroll;
          savePosition(active.current, previousPosition, true);
          const firstView = !visited.current.has(post.slug);
          visited.current.add(post.slug);
          active.current = post.slug;
          document.title = post.metaTitle ?? `${post.title} - Блог Artmate`;
          const url = routes.blogPost(post.slug);
          const state = {
            blogReading: { feed, slug: post.slug, scrollY: window.scrollY },
            ...virtualPageViewState(new URL(url, window.location.origin).href, firstView),
          };
          // Do not copy Next's internal state here: its native History API adapter
          // must synchronize usePathname and the existing page-view listeners.
          if (firstView) history.pushState(state, "", url);
          else history.replaceState(state, "", url);
          setActiveSlug(post.slug);
        } else if (Date.now() - lastSavedAt >= 1000 && window.scrollY !== lastScroll) {
          // Persist at most once a second to avoid browser History API rate limits.
          // Keep the current entry's view marker until the SPA listener consumes it.
          lastSavedAt = Date.now();
          history.replaceState(
            { ...history.state, blogReading: { feed, slug: post.slug, scrollY: window.scrollY } },
            "",
          );
        }
        lastScroll = window.scrollY;
      });
    };
    const restore = () => {
      const saved = history.state?.blogReading;
      if (saved?.feed !== feed || !posts.some((post) => post.slug === saved.slug)) return;
      active.current = saved.slug;
      visited.current.add(saved.slug);
      setActiveSlug(saved.slug);
      const post = posts.find((candidate) => candidate.slug === saved.slug)!;
      document.title = post.metaTitle ?? `${post.title} - Блог Artmate`;
      savePosition(saved.slug, saved.scrollY, true);
      lastScroll = saved.scrollY;
      window.scrollTo({ top: saved.scrollY, behavior: "instant" });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    window.addEventListener("popstate", restore);
    document.addEventListener("visibilitychange", update);
    const observer = new ResizeObserver(update);
    for (const post of posts) {
      const element = document.getElementById(articleElementId(post.slug));
      if (element) observer.observe(element);
    }
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      history.scrollRestoration = previousRestoration;
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("popstate", restore);
      document.removeEventListener("visibilitychange", update);
    };
  }, [feed, posts]);

  return activeSlug;
}
