import type { BlogPostBlock, BlogPostContent } from "../blog/blog.types";

export const aiBlogDraftSourceTypes = [
  "mixed",
  "product_news",
  "internet_research",
] as const;
export type AiBlogDraftSourceType = (typeof aiBlogDraftSourceTypes)[number];

export const aiBlogDraftRunStatuses = [
  "topic_review",
  "outline_review",
  "draft_review",
  "draft_created",
  "rejected",
  "failed",
] as const;
export type AiBlogDraftRunStatus = (typeof aiBlogDraftRunStatuses)[number];

export type AiContentSource = {
  title: string;
  url: string;
  summary: string;
};

export type AiTopicSuggestion = {
  audience: string;
  angle: string;
  cta: string;
  rationale: string;
  sourceUrls: string[];
  title: string;
};

export type AiTopicSuggestions = {
  sources: AiContentSource[];
  topics: AiTopicSuggestion[];
};

export type AiBlogDraftOutlineSection = {
  blockType: BlogPostBlock["type"];
  heading: string;
  notes: string;
};

export type AiBlogDraftOutline = {
  sections: AiBlogDraftOutlineSection[];
  title: string;
};

export type AiGeneratedBlogDraft = {
  content: BlogPostContent;
  excerpt: string;
  imageAlt: string;
  imageUrl: string;
  metaDescription: string;
  metaTitle: string;
  slug: string;
  title: string;
};

export type BlogDraftResearchContext = {
  existingPosts: Array<{
    category: string | null;
    excerpt: string;
    slug: string;
    tags: string[];
    title: string;
  }>;
  products: Array<{
    category: string | null;
    description: string | null;
    imageUrl: string | null;
    priceRub: number;
    slug: string;
    title: string;
  }>;
};
