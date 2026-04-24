import type { BlogPostsData } from "@/shared/actions/blog";

export type { BlogAuthor, BlogPost, BlogPostsData } from "@/shared/actions/blog";

export const emptyBlogPostsData: BlogPostsData = {
  items: [],
};
