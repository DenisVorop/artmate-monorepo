"use server";

import { createFallbackBlogArticleContent, type BlogArticleContent } from "./blog-content.data";
import type {
  BlogAuthor,
  BlogAuthorDTO,
  BlogCategoryDTO,
  BlogPost,
  BlogPostBlock,
  BlogPostDTO,
  BlogPostsData,
  BlogTagDTO,
} from "./blog.data";
import { ApiResult, type ApiResultDTO } from "@/shared/lib/api-result";

const DEFAULT_API_BASE_URL = "http://localhost:3002";
const defaultBlogImage =
  "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=1200&q=80";
const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export async function getBlogPosts(): Promise<ApiResultDTO<BlogPostsData>> {
  const result = await ApiResult.prepareApi(async () => {
    const posts = await requestBlogApi<BlogPostDTO[]>("/blog/posts");

    return {
      items: posts.map(mapBlogPost),
    } satisfies BlogPostsData;
  }, {
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
  if (!id) {
    return undefined;
  }

  const post = await getBlogPostBySlug(id);

  if (post) {
    return post;
  }

  const posts = (await getBlogPosts()).data?.items ?? [];

  return posts.find((candidate) => candidate.id === id || candidate.apiId === id);
}

export async function getBlogPostBySlug(slug?: string) {
  if (!slug) {
    return undefined;
  }

  const result = await ApiResult.prepareApi(async () =>
    mapBlogPost(await requestBlogApi<BlogPostDTO>(`/blog/posts/${encodeURIComponent(slug)}`)),
  )();

  return result.data;
}

export async function getBlogPostContent(post: BlogPost): Promise<BlogArticleContent> {
  return hasContentBlocks(post.content) ? post.content : createFallbackBlogArticleContent(post);
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
  const candidates = posts.filter((candidate) => candidate.slug !== post.slug);
  const sameCategory = candidates.filter((candidate) => candidate.category === post.category);
  const sameTags = candidates.filter(
    (candidate) =>
      candidate.category !== post.category && candidate.tags.some((tag) => post.tags.includes(tag)),
  );
  const seen = new Set([...sameCategory, ...sameTags].map((candidate) => candidate.slug));
  const rest = candidates.filter((candidate) => !seen.has(candidate.slug));

  return [...sameCategory, ...sameTags, ...rest].slice(0, limit);
}

async function requestBlogApi<T>(path: string) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    next: {
      revalidate: 300,
      tags: ["blog-posts"],
    },
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }

  return (await response.json()) as T;
}

function mapBlogPost(post: BlogPostDTO): BlogPost {
  const slug = post.slug || post.id;
  const readTimeMinutes = normalizeReadTimeMinutes(post.readTimeMinutes);
  const mappedPost = {
    id: slug,
    apiId: post.id,
    slug,
    title: post.title,
    excerpt: post.excerpt,
    category: mapCategory(post.category),
    date: formatPostDate(post.publishedAt ?? post.createdAt),
    readTime: readTimeMinutes ? `${readTimeMinutes} мин` : "5 мин",
    readTimeMinutes,
    image: post.imageUrl || defaultBlogImage,
    imageAlt: post.imageAlt || post.title,
    metaTitle: post.metaTitle ?? undefined,
    metaDescription: post.metaDescription ?? undefined,
    publishedAt: post.publishedAt ?? undefined,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    status: post.status,
    tags: post.tags.map(mapTag).filter(Boolean),
    author: mapAuthor(post.author),
    featured: post.featured,
    content: normalizeContent(post.content),
  } satisfies BlogPost;

  return {
    ...mappedPost,
    content: hasContentBlocks(mappedPost.content)
      ? mappedPost.content
      : createFallbackBlogArticleContent(mappedPost),
  };
}

function normalizeContent(content: BlogPostDTO["content"]): BlogArticleContent {
  if (!content || content.schemaVersion !== 1 || !Array.isArray(content.blocks)) {
    return {
      schemaVersion: 1,
      blocks: [],
    };
  }

  return {
    schemaVersion: 1,
    blocks: content.blocks.filter(isSupportedBlock),
  };
}

function isSupportedBlock(block: BlogPostBlock): block is BlogPostBlock {
  return Boolean(block?.id && block.type);
}

function hasContentBlocks(content: BlogArticleContent) {
  return content.blocks.length > 0;
}

function mapAuthor(author: BlogAuthorDTO): BlogAuthor {
  if (typeof author === "string") {
    return {
      name: author,
      role: "Автор блога Artmate",
      avatar: getAvatar(author),
      bio: "Делится практическими советами о раскрашивании, материалах и спокойной творческой практике.",
    };
  }

  const name = author?.name || "Редакция Artmate";

  return {
    name,
    role: author?.role || "Автор блога Artmate",
    avatar: author?.avatar || getAvatar(name),
    bio:
      author?.bio ||
      "Делится практическими советами о раскрашивании, материалах и спокойной творческой практике.",
  };
}

function mapCategory(category: BlogCategoryDTO | undefined) {
  if (typeof category === "string") {
    return category;
  }

  return category?.title || category?.name || "Без категории";
}

function mapTag(tag: BlogTagDTO) {
  if (typeof tag === "string") {
    return tag;
  }

  return tag.title || tag.name || tag.slug || "";
}

function normalizeReadTimeMinutes(readTimeMinutes: BlogPostDTO["readTimeMinutes"]) {
  if (typeof readTimeMinutes !== "number" || !Number.isFinite(readTimeMinutes)) {
    return undefined;
  }

  return Math.max(1, Math.round(readTimeMinutes));
}

function formatPostDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return dateFormatter.format(date);
}

function getAvatar(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function getApiBaseUrl() {
  return process.env.API_BASE_URL ?? DEFAULT_API_BASE_URL;
}

async function getResponseErrorMessage(response: Response) {
  const fallback = `Blog API request failed with status ${response.status}`;

  try {
    const body = (await response.json()) as {
      message?: unknown;
    };

    if (typeof body.message === "string") {
      return body.message;
    }

    if (Array.isArray(body.message)) {
      return body.message.join(", ");
    }
  } catch {
    return fallback;
  }

  return fallback;
}
