import { z } from "zod";

import type {
  BlogCategory,
  BlogPost,
  BlogPostBlock,
  BlogPostContent,
  BlogPostStatus,
} from "@/entities/blog";
import {
  blogPostStatuses,
  type CreateBlogAuthorInputDTO,
  type CreateBlogCategoryInputDTO,
  type CreateBlogPostInputDTO,
  type CreateBlogTagInputDTO,
  type UpdateBlogPostInputDTO,
} from "@/shared/actions/blog";

const requiredTextSchema = (message: string) =>
  z.string().trim().min(1, message);
const optionalTextSchema = z.string().trim();

export const blogPostFormSchema = z.object({
  authorId: requiredTextSchema("Выберите автора"),
  categoryId: requiredTextSchema("Выберите категорию"),
  excerpt: requiredTextSchema("Укажите описание"),
  featured: z.boolean(),
  imageAlt: optionalTextSchema,
  imageUrl: optionalTextSchema,
  metaDescription: optionalTextSchema,
  metaTitle: optionalTextSchema,
  publishedAt: optionalTextSchema,
  readTimeMinutes: z
    .number()
    .int("Укажите целое количество минут")
    .min(0, "Время чтения не может быть отрицательным"),
  slug: requiredTextSchema("Укажите slug"),
  status: z.enum(blogPostStatuses),
  tagIds: z.array(z.string()),
  title: requiredTextSchema("Укажите заголовок"),
});

export const deleteBlogPostFormSchema = z.object({
  postId: requiredTextSchema("Не указан пост"),
});

export const blogAuthorFormSchema = z.object({
  avatar: optionalTextSchema,
  bio: optionalTextSchema,
  image: optionalTextSchema,
  name: requiredTextSchema("Укажите имя автора"),
  role: optionalTextSchema,
  slug: requiredTextSchema("Укажите slug"),
});

export const blogCategoryFormSchema = z.object({
  description: optionalTextSchema,
  slug: requiredTextSchema("Укажите slug"),
  title: requiredTextSchema("Укажите название"),
});

export const blogTagFormSchema = z.object({
  slug: requiredTextSchema("Укажите slug"),
  title: requiredTextSchema("Укажите название"),
});

export type BlogPostFormValues = z.infer<typeof blogPostFormSchema>;
export type DeleteBlogPostFormValues = z.infer<typeof deleteBlogPostFormSchema>;
export type BlogAuthorFormValues = z.infer<typeof blogAuthorFormSchema>;
export type BlogCategoryFormValues = z.infer<typeof blogCategoryFormSchema>;
export type BlogTagFormValues = z.infer<typeof blogTagFormSchema>;

export const emptyBlogPostContent = {
  schemaVersion: 1,
  blocks: [],
} satisfies BlogPostContent;

export const createBlogAuthorDefaultValues = {
  avatar: "",
  bio: "",
  image: "",
  name: "",
  role: "",
  slug: "",
} satisfies BlogAuthorFormValues;

export const createBlogCategoryDefaultValues = {
  description: "",
  slug: "",
  title: "",
} satisfies BlogCategoryFormValues;

export const createBlogTagDefaultValues = {
  slug: "",
  title: "",
} satisfies BlogTagFormValues;

export function getCreateBlogPostDefaultValues({
  categories,
  defaultStatus = "draft",
}: {
  readonly categories: readonly BlogCategory[];
  readonly defaultStatus?: BlogPostStatus;
}): BlogPostFormValues {
  return {
    authorId: "",
    categoryId: categories[0]?.id ?? "",
    excerpt: "",
    featured: false,
    imageAlt: "",
    imageUrl: "",
    metaDescription: "",
    metaTitle: "",
    publishedAt: "",
    readTimeMinutes: 0,
    slug: "",
    status: defaultStatus,
    tagIds: [],
    title: "",
  };
}

export function getBlogPostDefaultValues(post: BlogPost): BlogPostFormValues {
  return {
    authorId: post.authorId,
    categoryId: post.categoryId,
    excerpt: post.excerpt,
    featured: post.featured,
    imageAlt: post.imageAlt ?? "",
    imageUrl: post.imageUrl ?? "",
    metaDescription: post.metaDescription ?? "",
    metaTitle: post.metaTitle ?? "",
    publishedAt: toDatetimeLocalValue(post.publishedAt),
    readTimeMinutes: post.readTimeMinutes ?? 0,
    slug: post.slug,
    status: post.status,
    tagIds: post.tags.map((tag) => tag.id),
    title: post.title,
  };
}

export function getCreateBlogPostInput(
  values: BlogPostFormValues,
  content: BlogPostContent,
): CreateBlogPostInputDTO {
  return {
    authorId: values.authorId,
    categoryId: values.categoryId,
    content: normalizeBlogPostContent(content),
    excerpt: values.excerpt.trim(),
    featured: values.featured,
    imageAlt: getOptionalText(values.imageAlt),
    imageUrl: getOptionalText(values.imageUrl),
    metaDescription: getOptionalText(values.metaDescription),
    metaTitle: getOptionalText(values.metaTitle),
    publishedAt: getOptionalDate(values.publishedAt),
    readTimeMinutes: values.readTimeMinutes || null,
    slug: values.slug.trim(),
    status: values.status,
    tagIds: values.tagIds,
    title: values.title.trim(),
  };
}

export function getUpdateBlogPostInput(
  values: BlogPostFormValues,
  content: BlogPostContent,
): UpdateBlogPostInputDTO {
  return getCreateBlogPostInput(values, content);
}

export function getCreateBlogAuthorInput(
  values: BlogAuthorFormValues,
): CreateBlogAuthorInputDTO {
  return {
    avatar: getOptionalText(values.avatar),
    bio: getOptionalText(values.bio),
    image: getOptionalText(values.image),
    name: values.name.trim(),
    role: getOptionalText(values.role),
    slug: values.slug.trim(),
  };
}

export function getCreateBlogCategoryInput(
  values: BlogCategoryFormValues,
): CreateBlogCategoryInputDTO {
  return {
    description: getOptionalText(values.description),
    slug: values.slug.trim(),
    title: values.title.trim(),
  };
}

export function getCreateBlogTagInput(
  values: BlogTagFormValues,
): CreateBlogTagInputDTO {
  return {
    slug: values.slug.trim(),
    title: values.title.trim(),
  };
}

export function normalizeBlogPostContent(content?: BlogPostContent | null) {
  return {
    schemaVersion: 1,
    blocks: content?.blocks ?? [],
  } satisfies BlogPostContent;
}

export function createBlogPostBlock(type: BlogPostBlock["type"]): BlogPostBlock {
  const id = createBlockId();

  switch (type) {
    case "heading":
      return {
        id,
        type,
        level: 2,
        text: "",
      };
    case "paragraph":
      return {
        id,
        type,
        text: "",
      };
    case "image":
      return {
        id,
        type,
        alt: "",
        src: "",
      };
    case "quote":
      return {
        id,
        type,
        text: "",
      };
    case "highlights":
      return {
        id,
        type,
        items: [createHighlightItem()],
      };
    case "steps":
      return {
        id,
        type,
        items: [createStepItem()],
      };
    case "cta":
      return {
        id,
        type,
        description: "",
        href: "",
        label: "",
        title: "",
      };
  }
}

export function duplicateBlogPostBlock(block: BlogPostBlock): BlogPostBlock {
  return {
    ...block,
    id: createBlockId(),
    ...(block.type === "highlights"
      ? {
          items: block.items.map((item) => ({ ...item })),
        }
      : {}),
    ...(block.type === "steps"
      ? {
          items: block.items.map((item) => ({ ...item })),
        }
      : {}),
  } as BlogPostBlock;
}

export function createHighlightItem() {
  return {
    title: "",
    description: "",
    emoji: "",
  };
}

export function createStepItem() {
  return {
    title: "",
    description: "",
  };
}

function createBlockId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `block-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getOptionalText(value: string) {
  const trimmed = value.trim();

  return trimmed ? trimmed : undefined;
}

function getOptionalDate(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  return new Date(trimmed).toISOString();
}

function toDatetimeLocalValue(value?: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const timezoneOffsetMs = date.getTimezoneOffset() * 60 * 1000;

  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
}
