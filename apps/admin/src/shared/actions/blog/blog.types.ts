export const blogPostStatuses = ["draft", "published", "archived"] as const;
export type BlogPostStatusDTO = (typeof blogPostStatuses)[number];

export type BlogAuthorDTO = {
  id: string;
  slug: string;
  name: string;
  role?: string;
  avatar?: string;
  image?: string;
  bio?: string;
  createdAt: string;
  updatedAt: string;
};

export type BlogCategoryDTO = {
  id: string;
  slug: string;
  title: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
};

export type BlogTagDTO = {
  id: string;
  slug: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type BlogHeadingBlockDTO = {
  id: string;
  type: "heading";
  level: 2 | 3;
  text: string;
  anchor?: string;
};

export type BlogParagraphBlockDTO = {
  id: string;
  type: "paragraph";
  text: string;
};

export type BlogImageBlockDTO = {
  id: string;
  type: "image";
  src: string;
  alt: string;
  caption?: string;
};

export type BlogQuoteBlockDTO = {
  id: string;
  type: "quote";
  text: string;
  author?: string;
};

export type BlogHighlightsBlockDTO = {
  id: string;
  type: "highlights";
  items: {
    title: string;
    description: string;
    emoji?: string;
  }[];
};

export type BlogStepsBlockDTO = {
  id: string;
  type: "steps";
  items: {
    title: string;
    description: string;
  }[];
};

export type BlogCtaBlockDTO = {
  id: string;
  type: "cta";
  title: string;
  description: string;
  href: string;
  label: string;
};

export type BlogPostBlockDTO =
  | BlogHeadingBlockDTO
  | BlogParagraphBlockDTO
  | BlogImageBlockDTO
  | BlogQuoteBlockDTO
  | BlogHighlightsBlockDTO
  | BlogStepsBlockDTO
  | BlogCtaBlockDTO;

export type BlogPostContentDTO = {
  schemaVersion: 1;
  blocks: BlogPostBlockDTO[];
};

export type BlogPostDTO = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  status: BlogPostStatusDTO;
  featured: boolean;
  readTimeMinutes?: number | null;
  imageUrl?: string;
  imageAlt?: string;
  metaTitle?: string;
  metaDescription?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  authorId: string;
  categoryId: string;
  author: BlogAuthorDTO;
  category: BlogCategoryDTO;
  tags: BlogTagDTO[];
  content?: BlogPostContentDTO | null;
};

export type CreateBlogPostInputDTO = {
  title: string;
  slug: string;
  excerpt: string;
  status?: BlogPostStatusDTO;
  featured?: boolean;
  readTimeMinutes?: number | null;
  imageUrl?: string;
  imageAlt?: string;
  metaTitle?: string;
  metaDescription?: string;
  publishedAt?: string | null;
  authorId: string;
  categoryId: string;
  tagIds?: string[];
  content?: BlogPostContentDTO | null;
};

export type UpdateBlogPostInputDTO = Partial<
  Omit<CreateBlogPostInputDTO, "authorId" | "categoryId" | "tagIds">
> & {
  authorId?: string;
  categoryId?: string;
  tagIds?: string[];
};

export type CreateBlogAuthorInputDTO = {
  slug: string;
  name: string;
  role?: string;
  avatar?: string;
  image?: string;
  bio?: string;
};

export type CreateBlogCategoryInputDTO = {
  slug: string;
  title: string;
  description?: string;
};

export type CreateBlogTagInputDTO = {
  slug: string;
  title: string;
};
