"use client";

import { useMemo, useState } from "react";
import type { BlogArticleContent } from "@/entities/blog";
import { headingElementId } from "./reading-stream";

export function useContentsState(content: BlogArticleContent, slug: string) {
  const [expanded, setExpanded] = useState("");
  const items = useMemo(() => {
    return content.blocks.flatMap((block) =>
      block.type === "heading"
        ? [
            {
              id: headingElementId(slug, block.anchor ?? block.id),
              label: block.text,
              level: block.level,
            },
          ]
        : [],
    );
  }, [content, slug]);

  return { items, expanded, setExpanded, close: () => setExpanded("") };
}
