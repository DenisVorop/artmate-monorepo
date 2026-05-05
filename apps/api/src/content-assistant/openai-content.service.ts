import { BadRequestException, Injectable } from "@nestjs/common";
import OpenAI from "openai";

import type { BlogPostBlock } from "../blog/blog.types";
import type {
  AiBlogDraftOutline,
  AiBlogDraftSourceType,
  AiGeneratedBlogDraft,
  AiTopicSuggestions,
  BlogDraftResearchContext,
} from "./content-assistant.types";

const defaultOpenAiModel = "gpt-5.2";

@Injectable()
export class OpenAiContentService {
  private client?: OpenAI;

  async generateTopicSuggestions({
    context,
    prompt,
    sourceType,
  }: {
    context: BlogDraftResearchContext;
    prompt?: string;
    sourceType: AiBlogDraftSourceType;
  }): Promise<AiTopicSuggestions> {
    return this.createJsonResponse<AiTopicSuggestions>({
      includeWebSearch: true,
      input: [
        `Режим: ${sourceType}.`,
        prompt ? `Дополнительный фокус от администратора: ${prompt}` : "",
        "Контекст Artmate:",
        JSON.stringify(context),
        "Найди актуальные темы в интернете для блога Artmate.",
        "Тематики: раскраски по номерам, товары для творчества, спокойный досуг, подарки, антистресс-хобби, домашний уют, творческие новинки.",
        "Не предлагай тему, если ее нельзя обосновать источниками или данными Artmate.",
        "Верни JSON со списком источников и 3-5 тем.",
      ].join("\n"),
      instructions:
        "Ты редактор блога Artmate. Ищи актуальные темы, но не выдумывай факты. Каждая тема должна быть пригодна для статьи в блоге интернет-магазина и вести к мягкому CTA на товары/категории Artmate.",
      schema: topicSuggestionsSchema,
      schemaName: "ai_blog_topic_suggestions",
    });
  }

  async generateOutline({
    context,
    topic,
  }: {
    context: BlogDraftResearchContext;
    topic: unknown;
  }): Promise<AiBlogDraftOutline> {
    return this.createJsonResponse<AiBlogDraftOutline>({
      input: [
        "Согласованная тема:",
        JSON.stringify(topic),
        "Контекст Artmate:",
        JSON.stringify(context),
        "Собери структуру будущей статьи строго из доступных типов блоков: heading, paragraph, image, quote, highlights, steps, cta.",
        "Структура должна быть понятной редактору: что будет в каждом блоке, какие факты нужно использовать, где уместен CTA.",
        "Верни JSON.",
      ].join("\n"),
      instructions:
        "Ты выпускающий редактор. Делай структуру статьи полезной, не рекламной по тону. В структуре не должно быть неподтвержденных обещаний или медицинских утверждений.",
      schema: outlineSchema,
      schemaName: "ai_blog_draft_outline",
    });
  }

  async generateDraft({
    context,
    outline,
    topic,
  }: {
    context: BlogDraftResearchContext;
    outline: AiBlogDraftOutline;
    topic: unknown;
  }): Promise<AiGeneratedBlogDraft> {
    const generated = await this.createJsonResponse<GeneratedDraftPayload>({
      input: [
        "Согласованная тема:",
        JSON.stringify(topic),
        "Согласованная структура:",
        JSON.stringify(outline),
        "Контекст Artmate:",
        JSON.stringify(context),
        "Напиши полный черновик статьи для блога Artmate.",
        "Контент должен быть в JSON и собран только из поддерживаемых блоков.",
        "Для slug используй только латиницу, цифры и дефисы.",
        "Для image blocks используй только imageUrl из контекста Artmate; если подходящего изображения нет, оставь src пустым.",
        "CTA должен вести на релевантный товар, категорию или /catalog.",
      ].join("\n"),
      instructions:
        "Ты редактор блога Artmate. Пиши на русском, спокойно и предметно. Не выдумывай характеристики товаров, цены или факты. Не используй агрессивные продажи.",
      schema: generatedDraftSchema,
      schemaName: "ai_generated_blog_draft",
    });

    return {
      content: {
        schemaVersion: 1,
        blocks: generated.content.blocks.map((block, index) =>
          mapGeneratedBlock(block, index),
        ),
      },
      excerpt: generated.excerpt,
      imageAlt: generated.imageAlt,
      imageUrl: generated.imageUrl,
      metaDescription: generated.metaDescription,
      metaTitle: generated.metaTitle,
      slug: generated.slug,
      title: generated.title,
    };
  }

  private async createJsonResponse<T>({
    includeWebSearch = false,
    input,
    instructions,
    schema,
    schemaName,
  }: {
    includeWebSearch?: boolean;
    input: string;
    instructions: string;
    schema: Record<string, unknown>;
    schemaName: string;
  }): Promise<T> {
    const response = await this.getClient().responses.create({
      input,
      instructions,
      model: process.env.OPENAI_MODEL ?? defaultOpenAiModel,
      text: {
        format: {
          name: schemaName,
          schema,
          strict: true,
          type: "json_schema",
        },
      },
      tool_choice: includeWebSearch ? "auto" : "none",
      tools: includeWebSearch ? [{ type: "web_search" }] : [],
    });
    const outputText = response.output_text;

    if (!outputText) {
      throw new BadRequestException(
        "OpenAI response did not contain JSON output",
      );
    }

    try {
      return JSON.parse(outputText) as T;
    } catch {
      throw new BadRequestException("OpenAI response contained invalid JSON");
    }
  }

  private getClient() {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new BadRequestException("OPENAI_API_KEY is not configured");
    }

    this.client ??= new OpenAI({ apiKey });

    return this.client;
  }
}

type GeneratedBlockPayload = {
  alt: string;
  anchor: string;
  author: string;
  caption: string;
  ctaDescription: string;
  ctaHref: string;
  ctaLabel: string;
  ctaTitle: string;
  id: string;
  items: Array<{
    description: string;
    emoji: string;
    title: string;
  }>;
  level: 0 | 2 | 3;
  src: string;
  steps: Array<{
    description: string;
    title: string;
  }>;
  text: string;
  type:
    | "heading"
    | "paragraph"
    | "image"
    | "quote"
    | "highlights"
    | "steps"
    | "cta";
};

type GeneratedDraftPayload = Omit<AiGeneratedBlogDraft, "content"> & {
  content: {
    blocks: GeneratedBlockPayload[];
  };
};

function mapGeneratedBlock(
  block: GeneratedBlockPayload,
  index: number,
): BlogPostBlock {
  const id = block.id || `ai-block-${index + 1}`;

  switch (block.type) {
    case "heading":
      return {
        id,
        anchor: cleanOptionalText(block.anchor),
        level: block.level === 3 ? 3 : 2,
        text: cleanRequiredText(block.text, "Заголовок"),
        type: "heading",
      };
    case "paragraph":
      return {
        id,
        text: cleanRequiredText(block.text, "Текст абзаца"),
        type: "paragraph",
      };
    case "image":
      return {
        id,
        alt: cleanRequiredText(block.alt, "Изображение статьи"),
        caption: cleanOptionalText(block.caption),
        src: block.src.trim(),
        type: "image",
      };
    case "quote":
      return {
        id,
        author: cleanOptionalText(block.author),
        text: cleanRequiredText(block.text, "Цитата"),
        type: "quote",
      };
    case "highlights":
      return {
        id,
        items: block.items.map((item) => ({
          description: cleanRequiredText(item.description, "Описание"),
          emoji: cleanOptionalText(item.emoji),
          title: cleanRequiredText(item.title, "Пункт"),
        })),
        type: "highlights",
      };
    case "steps":
      return {
        id,
        items: block.steps.map((item) => ({
          description: cleanRequiredText(item.description, "Описание шага"),
          title: cleanRequiredText(item.title, "Шаг"),
        })),
        type: "steps",
      };
    case "cta":
      return {
        id,
        description: cleanRequiredText(
          block.ctaDescription,
          "Перейти в каталог",
        ),
        href: cleanRequiredText(block.ctaHref, "/catalog"),
        label: cleanRequiredText(block.ctaLabel, "Смотреть подборку"),
        title: cleanRequiredText(block.ctaTitle, "Подобрать раскраску"),
        type: "cta",
      };
  }
}

function cleanRequiredText(value: string, fallback: string) {
  return value.trim() || fallback;
}

function cleanOptionalText(value: string) {
  return value.trim() || undefined;
}

const sourceSchema = {
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    title: { type: "string" },
    url: { type: "string" },
  },
  required: ["title", "url", "summary"],
  type: "object",
} as const;

const topicSuggestionsSchema = {
  additionalProperties: false,
  properties: {
    sources: {
      items: sourceSchema,
      type: "array",
    },
    topics: {
      items: {
        additionalProperties: false,
        properties: {
          audience: { type: "string" },
          angle: { type: "string" },
          cta: { type: "string" },
          rationale: { type: "string" },
          sourceUrls: {
            items: { type: "string" },
            type: "array",
          },
          title: { type: "string" },
        },
        required: [
          "title",
          "angle",
          "audience",
          "rationale",
          "cta",
          "sourceUrls",
        ],
        type: "object",
      },
      type: "array",
    },
  },
  required: ["sources", "topics"],
  type: "object",
} as const;

const outlineSchema = {
  additionalProperties: false,
  properties: {
    sections: {
      items: {
        additionalProperties: false,
        properties: {
          blockType: {
            enum: [
              "heading",
              "paragraph",
              "image",
              "quote",
              "highlights",
              "steps",
              "cta",
            ],
            type: "string",
          },
          heading: { type: "string" },
          notes: { type: "string" },
        },
        required: ["blockType", "heading", "notes"],
        type: "object",
      },
      type: "array",
    },
    title: { type: "string" },
  },
  required: ["title", "sections"],
  type: "object",
} as const;

const generatedBlockSchema = {
  additionalProperties: false,
  properties: {
    alt: { type: "string" },
    anchor: { type: "string" },
    author: { type: "string" },
    caption: { type: "string" },
    ctaDescription: { type: "string" },
    ctaHref: { type: "string" },
    ctaLabel: { type: "string" },
    ctaTitle: { type: "string" },
    id: { type: "string" },
    items: {
      items: {
        additionalProperties: false,
        properties: {
          description: { type: "string" },
          emoji: { type: "string" },
          title: { type: "string" },
        },
        required: ["title", "description", "emoji"],
        type: "object",
      },
      type: "array",
    },
    level: { enum: [0, 2, 3], type: "integer" },
    src: { type: "string" },
    steps: {
      items: {
        additionalProperties: false,
        properties: {
          description: { type: "string" },
          title: { type: "string" },
        },
        required: ["title", "description"],
        type: "object",
      },
      type: "array",
    },
    text: { type: "string" },
    type: {
      enum: [
        "heading",
        "paragraph",
        "image",
        "quote",
        "highlights",
        "steps",
        "cta",
      ],
      type: "string",
    },
  },
  required: [
    "id",
    "type",
    "level",
    "text",
    "anchor",
    "src",
    "alt",
    "caption",
    "author",
    "items",
    "steps",
    "ctaTitle",
    "ctaDescription",
    "ctaHref",
    "ctaLabel",
  ],
  type: "object",
} as const;

const generatedDraftSchema = {
  additionalProperties: false,
  properties: {
    content: {
      additionalProperties: false,
      properties: {
        blocks: {
          items: generatedBlockSchema,
          type: "array",
        },
      },
      required: ["blocks"],
      type: "object",
    },
    excerpt: { type: "string" },
    imageAlt: { type: "string" },
    imageUrl: { type: "string" },
    metaDescription: { type: "string" },
    metaTitle: { type: "string" },
    slug: { type: "string" },
    title: { type: "string" },
  },
  required: [
    "title",
    "slug",
    "excerpt",
    "imageUrl",
    "imageAlt",
    "metaTitle",
    "metaDescription",
    "content",
  ],
  type: "object",
} as const;
