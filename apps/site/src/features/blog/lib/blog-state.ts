import type { BlogPost } from "@/entities/blog";

export function getVisiblePosts(
  posts: BlogPost[],
  { query, category }: { query: string; category: string },
) {
  const normalizedQuery = query.trim().toLowerCase();

  return posts.filter((post) => {
    const matchesCategory = category === "Все" || post.category === category;
    const matchesQuery =
      !normalizedQuery ||
      post.title.toLowerCase().includes(normalizedQuery) ||
      post.excerpt.toLowerCase().includes(normalizedQuery);

    return matchesCategory && matchesQuery;
  });
}
