'use server';

import {
  BLOG_ARTICLE_CONTENT,
  createFallbackBlogArticleContent,
  type BlogArticleContent,
} from "./blog-content.data";
import { blogPostsData, type BlogPost, type BlogPostsData } from "./blog.data";
import { ApiResult, type ApiResultDTO } from "@/shared/lib/api-result";

export async function getBlogPosts(): Promise<ApiResultDTO<BlogPostsData>> {
  const result = await ApiResult.prepareApi(async () => blogPostsData, {
    isEmptyCb: (data) => data.items.length === 0,
  })();

  return result.toDTO() as ApiResultDTO<BlogPostsData>;
}

export async function getBlogCategories() {
  const posts = (await getBlogPosts()).data?.items ?? [];

  return Array.from(new Set(posts.map((post) => post.category)));
}

export async function getFeaturedPost() {
  const posts = (await getBlogPosts()).data?.items ?? [];

  return posts.find((post) => post.featured);
}

export async function getBlogPostById(id?: string) {
  const posts = (await getBlogPosts()).data?.items ?? [];

  return posts.find((post) => post.id === id);
}

export async function getBlogPostBySlug(slug?: string) {
  return getBlogPostById(slug);
}

export async function getBlogPostContent(post: BlogPost): Promise<BlogArticleContent> {
  return BLOG_ARTICLE_CONTENT[post.id] ?? createFallbackBlogArticleContent(post);
}

export type BlogPostPageDataDTO = {
  post?: BlogPost;
  content?: BlogArticleContent;
  relatedPosts: BlogPost[];
};

export async function getBlogPostPageData(slug: string): Promise<BlogPostPageDataDTO> {
  const post = await getBlogPostBySlug(slug);

  if (!post) {
    return {
      post: undefined,
      content: undefined,
      relatedPosts: [],
    };
  }

  return {
    post,
    content: await getBlogPostContent(post),
    relatedPosts: await getRelatedBlogPosts(post),
  };
}

export async function getRelatedBlogPosts(post: BlogPost, limit = 3) {
  const posts = (await getBlogPosts()).data?.items ?? [];
  const candidates = posts.filter((candidate) => candidate.id !== post.id);
  const sameCategory = candidates.filter((candidate) => candidate.category === post.category);
  const sameTags = candidates.filter(
    (candidate) =>
      candidate.category !== post.category &&
      candidate.tags.some((tag) => post.tags.includes(tag)),
  );
  const seen = new Set([...sameCategory, ...sameTags].map((candidate) => candidate.id));
  const rest = candidates.filter((candidate) => !seen.has(candidate.id));

  return [...sameCategory, ...sameTags, ...rest].slice(0, limit);
}
