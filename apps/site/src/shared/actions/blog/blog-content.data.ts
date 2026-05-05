import { routes } from "@/shared/constants";

import type {
  BlogArticleContent,
  BlogHighlightsBlock,
  BlogPost,
  BlogPostBlock,
  BlogStepsBlock,
} from "./blog.data";

export type BlogArticleHighlight = BlogHighlightsBlock["items"][number];
export type BlogArticleTip = BlogStepsBlock["items"][number];
export type BlogArticleSection = BlogPostBlock;
export type {
  BlogArticleContent,
  BlogCtaBlock,
  BlogHeadingBlock,
  BlogPostBlock,
} from "./blog.data";

export function createFallbackBlogArticleContent(post: BlogPost): BlogArticleContent {
  return {
    schemaVersion: 1,
    blocks: [
      {
        id: "summary",
        type: "heading",
        level: 2,
        text: `Коротко о теме «${post.title}»`,
      },
      {
        id: "summary-text",
        type: "paragraph",
        text: post.excerpt,
      },
      {
        id: "practice",
        type: "cta",
        title: "Продолжить практику на новой странице",
        description:
          "Выберите сюжет с понятными формами и сразу примените советы из статьи в реальной работе.",
        href: routes.catalog,
        label: "Подобрать раскраску",
      },
    ],
  };
}
