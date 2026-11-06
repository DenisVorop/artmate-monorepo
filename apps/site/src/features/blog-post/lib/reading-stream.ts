import type { BlogPost } from "@/entities/blog";

export function articleElementId(slug: string) {
  return `article-${slug}`;
}

export function headingElementId(slug: string, anchor: string) {
  return `${articleElementId(slug)}--${anchor}`;
}

export function nextReadingPost(
  related: BlogPost[],
  posts: BlogPost[],
  loadedSlugs: readonly string[],
) {
  const loaded = new Set(loadedSlugs);
  return [...related, ...posts].find((post) => !loaded.has(post.slug));
}

// A new article becomes current only when its beginning enters the reading area.
export function readingIndex(starts: number[], readingLine: number) {
  let index = 0;
  for (let candidate = 1; candidate < starts.length; candidate += 1) {
    if (starts[candidate]! <= readingLine) index = candidate;
  }
  return index;
}
