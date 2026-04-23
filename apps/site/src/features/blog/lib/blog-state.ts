import { BLOG_POSTS, getBlogCategories } from "@/entities/blog";

export const allBlogCategories = ["Все", ...getBlogCategories()] as const;

export function getVisiblePosts({ query, category }: { query: string; category: string }) {
  const normalizedQuery = query.trim().toLowerCase();

  return BLOG_POSTS.filter((post) => {
    const matchesCategory = category === "Все" || post.category === category;
    const matchesQuery =
      !normalizedQuery ||
      post.title.toLowerCase().includes(normalizedQuery) ||
      post.excerpt.toLowerCase().includes(normalizedQuery);

    return matchesCategory && matchesQuery;
  });
}
