"use client";

import { useEffect } from "react";
import type { BlogPost } from "@/entities/blog";
import { getAbsoluteUrl, routes } from "@/shared/constants";

export function useArticleMetadata(post: BlogPost) {
  useEffect(() => {
    const title = post.metaTitle ?? `${post.title} - Блог Artmate`;
    const description = post.metaDescription ?? post.excerpt;
    const url = getAbsoluteUrl(routes.blogPost(post.slug));
    document.title = title;
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonical) canonical.href = url;
    const values: Record<string, string> = {
      'meta[name="description"]': description,
      'meta[property="og:title"]': title,
      'meta[property="og:description"]': description,
      'meta[property="og:url"]': url,
      'meta[property="og:image"]': post.image,
      'meta[name="twitter:title"]': title,
      'meta[name="twitter:description"]': description,
      'meta[name="twitter:image"]': post.image,
    };
    for (const [selector, value] of Object.entries(values)) {
      document.querySelector<HTMLMetaElement>(selector)?.setAttribute("content", value);
    }
  }, [post]);
}
