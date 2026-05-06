export const blogPostStatuses = ["draft", "published", "archived"] as const;
export type BlogPostStatus = (typeof blogPostStatuses)[number];

export const blogImageMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export type BlogImageMimeType = (typeof blogImageMimeTypes)[number];

export type BlogPostContent = {
  schemaVersion: 1;
  blocks: BlogPostBlock[];
};

export type BlogPostBlock =
  | BlogPostHeadingBlock
  | BlogPostParagraphBlock
  | BlogPostImageBlock
  | BlogPostQuoteBlock
  | BlogPostHighlightsBlock
  | BlogPostStepsBlock
  | BlogPostCtaBlock;

export type BlogPostHeadingBlock = {
  id: string;
  type: "heading";
  level: 2 | 3;
  text: string;
  anchor?: string;
};

export type BlogPostParagraphBlock = {
  id: string;
  type: "paragraph";
  text: string;
};

export type BlogPostImageBlock = {
  id: string;
  type: "image";
  src: string;
  alt: string;
  caption?: string;
};

export type BlogPostQuoteBlock = {
  id: string;
  type: "quote";
  text: string;
  author?: string;
};

export type BlogPostHighlightsBlock = {
  id: string;
  type: "highlights";
  items: BlogPostHighlightItem[];
};

export type BlogPostHighlightItem = {
  title: string;
  description: string;
  emoji?: string;
};

export type BlogPostStepsBlock = {
  id: string;
  type: "steps";
  items: BlogPostStepItem[];
};

export type BlogPostStepItem = {
  title: string;
  description: string;
};

export type BlogPostCtaBlock = {
  id: string;
  type: "cta";
  title: string;
  description: string;
  href: string;
  label: string;
};
