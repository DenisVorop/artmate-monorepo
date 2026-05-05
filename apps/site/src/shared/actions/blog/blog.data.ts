export type BlogAuthor = {
  name: string;
  role: string;
  avatar: string;
  bio: string;
};

export type BlogAuthorDTO =
  | string
  | Partial<{
      name: string | null;
      role: string | null;
      avatar: string | null;
      bio: string | null;
    }>
  | null;

export type BlogCategoryDTO =
  | string
  | Partial<{
      title: string | null;
      name: string | null;
      slug: string | null;
    }>
  | null;

export type BlogTagDTO =
  | string
  | Partial<{
      title: string | null;
      name: string | null;
      slug: string | null;
    }>;

export type BlogHeadingBlock = {
  id: string;
  type: "heading";
  level: 2 | 3;
  text: string;
  anchor?: string;
};

export type BlogParagraphBlock = {
  id: string;
  type: "paragraph";
  text: string;
};

export type BlogImageBlock = {
  id: string;
  type: "image";
  src: string;
  alt: string;
  caption?: string;
};

export type BlogQuoteBlock = {
  id: string;
  type: "quote";
  text: string;
  author?: string;
};

export type BlogHighlightsBlock = {
  id: string;
  type: "highlights";
  items: {
    title: string;
    description: string;
    emoji?: string;
  }[];
};

export type BlogStepsBlock = {
  id: string;
  type: "steps";
  items: {
    title: string;
    description: string;
  }[];
};

export type BlogCtaBlock = {
  id: string;
  type: "cta";
  title: string;
  description: string;
  href: string;
  label: string;
};

export type BlogPostBlock =
  | BlogHeadingBlock
  | BlogParagraphBlock
  | BlogImageBlock
  | BlogQuoteBlock
  | BlogHighlightsBlock
  | BlogStepsBlock
  | BlogCtaBlock;

export type BlogArticleContent = {
  schemaVersion: 1;
  blocks: BlogPostBlock[];
};

export type BlogPostDTO = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  status: string;
  featured: boolean;
  readTimeMinutes?: number | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  author: BlogAuthorDTO;
  category?: BlogCategoryDTO;
  tags: BlogTagDTO[];
  content?: BlogArticleContent | null;
};

export type BlogPost = {
  id: string;
  apiId: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  date: string;
  readTime: string;
  readTimeMinutes?: number;
  image: string;
  imageAlt: string;
  metaTitle?: string;
  metaDescription?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  tags: string[];
  author: BlogAuthor;
  featured?: boolean;
  content: BlogArticleContent;
};

export type BlogPostsData = {
  items: BlogPost[];
};
