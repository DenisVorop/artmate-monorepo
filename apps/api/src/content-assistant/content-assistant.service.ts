import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { BlogService } from "../blog/blog.service";
import type { BlogPostBlock, BlogPostContent } from "../blog/blog.types";
import {
  AiBlogDraftRunStatus as PrismaAiBlogDraftRunStatus,
  AiBlogDraftSourceType as PrismaAiBlogDraftSourceType,
  BlogPostStatus as PrismaBlogPostStatus,
  Prisma,
  ProductStatus as PrismaProductStatus,
} from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";

import type { StartAiBlogDraftRunRequestDTO } from "./dto";
import { OpenAiContentService } from "./openai-content.service";
import { TelegramApprovalService } from "./telegram-approval.service";
import type {
  AiBlogDraftOutline,
  AiBlogDraftRunStatus,
  AiBlogDraftSourceType,
  AiGeneratedBlogDraft,
  AiTopicSuggestions,
  BlogDraftResearchContext,
} from "./content-assistant.types";

type StoredAiBlogDraftRun = Prisma.AiBlogDraftRunGetPayload<object>;

@Injectable()
export class ContentAssistantService {
  constructor(
    private readonly blogService: BlogService,
    private readonly openAiContentService: OpenAiContentService,
    private readonly prisma: PrismaService,
    private readonly telegramApprovalService: TelegramApprovalService,
  ) {}

  async listBlogDraftRuns() {
    const runs = await this.prisma.aiBlogDraftRun.findMany({
      orderBy: {
        updatedAt: "desc",
      },
      take: 10,
    });

    return runs.map((run) => this.mapRun(run));
  }

  async startBlogDraftRun(
    input: StartAiBlogDraftRunRequestDTO,
    createdById: string,
  ) {
    const sourceType = input.sourceType ?? "mixed";
    const storedCreatedById = await this.getExistingUserId(createdById);
    const run = await this.prisma.aiBlogDraftRun.create({
      data: {
        createdById: storedCreatedById,
        prompt: getOptionalString(input.prompt),
        sourceType: mapSourceTypeToPrisma(sourceType),
        status: PrismaAiBlogDraftRunStatus.TOPIC_REVIEW,
      },
    });

    try {
      const context = await this.getResearchContext(sourceType);
      const suggestions =
        await this.openAiContentService.generateTopicSuggestions({
          context,
          prompt: input.prompt,
          sourceType,
        });
      const updatedRun = await this.prisma.aiBlogDraftRun.update({
        data: {
          sources: suggestions.sources as unknown as Prisma.InputJsonValue,
          topics: suggestions as unknown as Prisma.InputJsonValue,
        },
        where: {
          id: run.id,
        },
      });

      await this.telegramApprovalService.sendTopicReview(
        updatedRun.id,
        suggestions,
      );

      return this.mapRun(updatedRun);
    } catch (error) {
      const failedRun = await this.markRunFailed(run.id, error);

      throw new BadRequestException(
        failedRun.errorMessage ?? "AI blog draft run failed",
      );
    }
  }

  async handleTelegramUpdate(update: unknown) {
    const callbackQuery = getTelegramCallbackQuery(update);

    if (!callbackQuery) {
      return { ok: true };
    }

    await this.telegramApprovalService.answerCallbackQuery(
      callbackQuery.id,
      "Принято",
    );

    const [namespace, action, runId, value] = callbackQuery.data.split("|");

    if (namespace !== "ai" || !runId) {
      return { ok: true };
    }

    switch (action) {
      case "topic":
        await this.selectTopic(runId, Number(value));
        break;
      case "outline":
        if (value === "approve") {
          await this.approveOutline(runId);
        }
        break;
      case "draft":
        if (value === "create") {
          await this.createBlogDraft(runId);
        }
        break;
      case "reject":
        await this.rejectRun(runId);
        break;
    }

    return { ok: true };
  }

  private async selectTopic(runId: string, topicIndex: number) {
    const run = await this.getRun(runId);
    const suggestions = getTopicSuggestions(run.topics);
    const topic = suggestions.topics[topicIndex];

    if (!topic || run.status !== PrismaAiBlogDraftRunStatus.TOPIC_REVIEW) {
      throw new BadRequestException("Topic cannot be selected for this run");
    }

    try {
      const context = await this.getResearchContext(
        mapPrismaSourceType(run.sourceType),
      );
      const outline = await this.openAiContentService.generateOutline({
        context,
        topic,
      });

      await this.prisma.aiBlogDraftRun.update({
        data: {
          outline: outline as unknown as Prisma.InputJsonValue,
          selectedTopicIndex: topicIndex,
          status: PrismaAiBlogDraftRunStatus.OUTLINE_REVIEW,
        },
        where: {
          id: run.id,
        },
      });

      await this.telegramApprovalService.sendOutlineReview(run.id, outline);
    } catch (error) {
      await this.failAndNotify(run.id, error);
    }
  }

  private async approveOutline(runId: string) {
    const run = await this.getRun(runId);

    if (run.status !== PrismaAiBlogDraftRunStatus.OUTLINE_REVIEW) {
      throw new BadRequestException("Outline cannot be approved for this run");
    }

    const topic = getSelectedTopic(run);
    const outline = getOutline(run.outline);

    try {
      const context = await this.getResearchContext(
        mapPrismaSourceType(run.sourceType),
      );
      const draft = await this.openAiContentService.generateDraft({
        context,
        outline,
        topic,
      });

      await this.prisma.aiBlogDraftRun.update({
        data: {
          draft: draft as unknown as Prisma.InputJsonValue,
          status: PrismaAiBlogDraftRunStatus.DRAFT_REVIEW,
        },
        where: {
          id: run.id,
        },
      });

      await this.telegramApprovalService.sendDraftReview(run.id, draft);
    } catch (error) {
      await this.failAndNotify(run.id, error);
    }
  }

  private async createBlogDraft(runId: string) {
    const run = await this.getRun(runId);

    if (run.status !== PrismaAiBlogDraftRunStatus.DRAFT_REVIEW) {
      throw new BadRequestException("Draft cannot be created for this run");
    }

    try {
      const draft = normalizeGeneratedDraft(getDraft(run.draft));
      const authorId = await this.getDefaultAuthorId();
      const categoryId = await this.getDefaultCategoryId();
      const slug = await this.getUniqueSlug(draft.slug || draft.title, run.id);
      const post = await this.blogService.createPost(
        {
          authorId,
          categoryId,
          content: draft.content,
          excerpt: draft.excerpt,
          featured: false,
          imageAlt: getOptionalString(draft.imageAlt),
          imageUrl: getOptionalString(draft.imageUrl),
          metaDescription: getOptionalString(draft.metaDescription),
          metaTitle: getOptionalString(draft.metaTitle),
          publishedAt: null,
          readTimeMinutes: estimateReadTimeMinutes(draft),
          slug,
          status: "draft",
          tagIds: [],
          title: draft.title,
        },
        run.createdById ?? undefined,
      );

      await this.prisma.aiBlogDraftRun.update({
        data: {
          blogPostId: post.id,
          status: PrismaAiBlogDraftRunStatus.DRAFT_CREATED,
        },
        where: {
          id: run.id,
        },
      });

      await this.telegramApprovalService.sendDraftCreated({
        adminUrl: getAdminBlogPostUrl(post.id),
        title: post.title,
      });
    } catch (error) {
      await this.failAndNotify(run.id, error);
    }
  }

  private async rejectRun(runId: string) {
    await this.prisma.aiBlogDraftRun.update({
      data: {
        status: PrismaAiBlogDraftRunStatus.REJECTED,
      },
      where: {
        id: runId,
      },
    });
    await this.telegramApprovalService.sendRejected(runId);
  }

  private async failAndNotify(runId: string, error: unknown) {
    const run = await this.markRunFailed(runId, error);

    await this.telegramApprovalService.sendFailure(
      runId,
      run.errorMessage ?? "Unknown error",
    );
  }

  private async markRunFailed(runId: string, error: unknown) {
    return this.prisma.aiBlogDraftRun.update({
      data: {
        errorMessage: getErrorMessage(error),
        status: PrismaAiBlogDraftRunStatus.FAILED,
      },
      where: {
        id: runId,
      },
    });
  }

  private async getRun(runId: string) {
    const run = await this.prisma.aiBlogDraftRun.findUnique({
      where: {
        id: runId,
      },
    });

    if (!run) {
      throw new NotFoundException("AI blog draft run not found");
    }

    return run;
  }

  private async getExistingUserId(userId: string) {
    const user = await this.prisma.user.findUnique({
      select: {
        id: true,
      },
      where: {
        id: userId,
      },
    });

    return user?.id;
  }

  private async getResearchContext(
    sourceType: AiBlogDraftSourceType,
  ): Promise<BlogDraftResearchContext> {
    const productTake = sourceType === "internet_research" ? 4 : 10;
    const products = await this.prisma.product.findMany({
      include: {
        category: true,
        images: {
          orderBy: [
            {
              sortOrder: "asc",
            },
            {
              createdAt: "asc",
            },
          ],
          take: 1,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: productTake,
      where: {
        status: PrismaProductStatus.PUBLISHED,
      },
    });
    const existingPosts = await this.prisma.blogPost.findMany({
      include: {
        category: true,
        tags: {
          include: {
            tag: true,
          },
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
      orderBy: {
        publishedAt: "desc",
      },
      take: 12,
      where: {
        status: PrismaBlogPostStatus.PUBLISHED,
      },
    });

    return {
      existingPosts: existingPosts.map((post) => ({
        category: post.category?.title ?? null,
        excerpt: post.excerpt,
        slug: post.slug,
        tags: post.tags.map((postTag) => postTag.tag.title),
        title: post.title,
      })),
      products: products.map((product) => ({
        category: product.category?.title ?? null,
        description: product.description,
        imageUrl: product.images[0]?.url ?? null,
        priceRub: Math.trunc(product.price / 100),
        slug: product.slug,
        title: product.title,
      })),
    };
  }

  private async getDefaultAuthorId() {
    const configuredAuthorId = getOptionalString(
      process.env.CONTENT_ASSISTANT_DEFAULT_BLOG_AUTHOR_ID,
    );

    if (configuredAuthorId) {
      return configuredAuthorId;
    }

    const author = await this.prisma.blogAuthor.findFirst({
      orderBy: {
        createdAt: "asc",
      },
      select: {
        id: true,
      },
    });

    if (!author) {
      throw new BadRequestException(
        "Create a blog author before using AI drafts",
      );
    }

    return author.id;
  }

  private async getDefaultCategoryId() {
    const configuredCategoryId = getOptionalString(
      process.env.CONTENT_ASSISTANT_DEFAULT_BLOG_CATEGORY_ID,
    );

    if (configuredCategoryId) {
      return configuredCategoryId;
    }

    const category = await this.prisma.blogCategory.findFirst({
      orderBy: {
        title: "asc",
      },
      select: {
        id: true,
      },
    });

    if (!category) {
      throw new BadRequestException(
        "Create a blog category before using AI drafts",
      );
    }

    return category.id;
  }

  private async getUniqueSlug(input: string, runId: string) {
    const baseSlug = slugify(input) || `ai-blog-${runId.slice(-8)}`;

    for (let index = 0; index < 50; index += 1) {
      const slug = index === 0 ? baseSlug : `${baseSlug}-${index + 1}`;
      const existingPost = await this.prisma.blogPost.findUnique({
        select: {
          id: true,
        },
        where: {
          slug,
        },
      });

      if (!existingPost) {
        return slug;
      }
    }

    return `${baseSlug}-${Date.now()}`;
  }

  private mapRun(run: StoredAiBlogDraftRun) {
    return {
      blogPostId: run.blogPostId ?? undefined,
      createdAt: run.createdAt.toISOString(),
      draft: run.draft ?? undefined,
      errorMessage: run.errorMessage ?? undefined,
      id: run.id,
      outline: run.outline ?? undefined,
      prompt: run.prompt ?? undefined,
      selectedTopicIndex: run.selectedTopicIndex ?? undefined,
      sources: run.sources ?? undefined,
      sourceType: mapPrismaSourceType(run.sourceType),
      status: mapPrismaStatus(run.status),
      topics: run.topics ?? undefined,
      updatedAt: run.updatedAt.toISOString(),
    };
  }
}

function getTopicSuggestions(
  value: Prisma.JsonValue | null,
): AiTopicSuggestions {
  const suggestions = value as AiTopicSuggestions | null;

  if (!suggestions?.topics?.length) {
    throw new BadRequestException("AI blog draft run has no topic suggestions");
  }

  return suggestions;
}

function getSelectedTopic(run: StoredAiBlogDraftRun) {
  if (run.selectedTopicIndex === null) {
    throw new BadRequestException("AI blog draft run has no selected topic");
  }

  const suggestions = getTopicSuggestions(run.topics);
  const topic = suggestions.topics[run.selectedTopicIndex];

  if (!topic) {
    throw new BadRequestException(
      "AI blog draft run selected topic is invalid",
    );
  }

  return topic;
}

function getOutline(value: Prisma.JsonValue | null): AiBlogDraftOutline {
  const outline = value as AiBlogDraftOutline | null;

  if (!outline?.sections?.length) {
    throw new BadRequestException("AI blog draft run has no outline");
  }

  return outline;
}

function getDraft(value: Prisma.JsonValue | null): AiGeneratedBlogDraft {
  const draft = value as AiGeneratedBlogDraft | null;

  if (!draft?.content?.blocks?.length) {
    throw new BadRequestException("AI blog draft run has no generated draft");
  }

  return draft;
}

function normalizeGeneratedDraft(
  draft: AiGeneratedBlogDraft,
): AiGeneratedBlogDraft {
  return {
    content: normalizeContent(draft.content),
    excerpt: truncate(cleanRequiredText(draft.excerpt, draft.title), 12000),
    imageAlt: truncate(draft.imageAlt.trim(), 220),
    imageUrl: truncate(draft.imageUrl.trim(), 2048),
    metaDescription: truncate(draft.metaDescription.trim(), 12000),
    metaTitle: truncate(draft.metaTitle.trim(), 220),
    slug: slugify(draft.slug),
    title: truncate(cleanRequiredText(draft.title, "AI draft"), 220),
  };
}

function normalizeContent(content: BlogPostContent): BlogPostContent {
  const blocks = content.blocks.map((block, index) =>
    normalizeBlock(block, index),
  );

  return {
    schemaVersion: 1,
    blocks:
      blocks.length > 0
        ? blocks
        : [
            {
              id: "ai-paragraph-1",
              text: "Черновик статьи создан AI-ассистентом.",
              type: "paragraph",
            },
          ],
  };
}

function normalizeBlock(block: BlogPostBlock, index: number): BlogPostBlock {
  const id = block.id || `ai-block-${index + 1}`;

  switch (block.type) {
    case "heading":
      return {
        ...block,
        id,
        text: truncate(cleanRequiredText(block.text, "Заголовок"), 220),
      };
    case "paragraph":
      return {
        ...block,
        id,
        text: truncate(cleanRequiredText(block.text, "Текст абзаца"), 12000),
      };
    case "image":
      return {
        ...block,
        alt: truncate(cleanRequiredText(block.alt, "Изображение статьи"), 220),
        caption: getOptionalString(block.caption),
        id,
        src: truncate(block.src.trim(), 2048),
      };
    case "quote":
      return {
        ...block,
        author: getOptionalString(block.author),
        id,
        text: truncate(cleanRequiredText(block.text, "Цитата"), 12000),
      };
    case "highlights":
      return {
        ...block,
        id,
        items: block.items.map((item) => ({
          description: truncate(
            cleanRequiredText(item.description, "Описание"),
            800,
          ),
          emoji: getOptionalString(item.emoji),
          title: truncate(cleanRequiredText(item.title, "Пункт"), 140),
        })),
      };
    case "steps":
      return {
        ...block,
        id,
        items: block.items.map((item) => ({
          description: truncate(
            cleanRequiredText(item.description, "Описание шага"),
            800,
          ),
          title: truncate(cleanRequiredText(item.title, "Шаг"), 140),
        })),
      };
    case "cta":
      return {
        ...block,
        description: truncate(
          cleanRequiredText(block.description, "Перейти в каталог"),
          800,
        ),
        href: cleanRequiredText(block.href, "/catalog"),
        id,
        label: truncate(
          cleanRequiredText(block.label, "Смотреть подборку"),
          80,
        ),
        title: truncate(
          cleanRequiredText(block.title, "Подобрать раскраску"),
          160,
        ),
      };
  }
}

function estimateReadTimeMinutes(draft: AiGeneratedBlogDraft) {
  const wordCount = collectDraftText(draft).split(/\s+/).filter(Boolean).length;

  return Math.max(1, Math.ceil(wordCount / 180));
}

function collectDraftText(draft: AiGeneratedBlogDraft) {
  return [
    draft.title,
    draft.excerpt,
    ...draft.content.blocks.flatMap((block) => {
      switch (block.type) {
        case "heading":
        case "paragraph":
        case "quote":
          return [block.text];
        case "highlights":
          return block.items.flatMap((item) => [item.title, item.description]);
        case "steps":
          return block.items.flatMap((item) => [item.title, item.description]);
        case "cta":
          return [block.title, block.description, block.label];
        case "image":
          return [block.alt, block.caption ?? ""];
      }
    }),
  ].join(" ");
}

function getTelegramCallbackQuery(update: unknown) {
  const record = asRecord(update);
  const callbackQuery = asRecord(record?.callback_query);
  const id = callbackQuery?.id;
  const data = callbackQuery?.data;

  if (typeof id !== "string" || typeof data !== "string") {
    return null;
  }

  return { data, id };
}

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function getOptionalString(value: string | null | undefined) {
  const text = value?.trim();

  return text || undefined;
}

function cleanRequiredText(value: string, fallback: string) {
  return value.trim() || fallback;
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown AI blog draft error";
}

function getAdminBlogPostUrl(postId: string) {
  const adminUrl = (process.env.ADMIN_URL ?? "http://localhost:3003").replace(
    /\/$/,
    "",
  );

  return `${adminUrl}/blog/${postId}`;
}

function mapSourceTypeToPrisma(sourceType: AiBlogDraftSourceType) {
  switch (sourceType) {
    case "internet_research":
      return PrismaAiBlogDraftSourceType.INTERNET_RESEARCH;
    case "product_news":
      return PrismaAiBlogDraftSourceType.PRODUCT_NEWS;
    case "mixed":
      return PrismaAiBlogDraftSourceType.MIXED;
  }
}

function mapPrismaSourceType(
  sourceType: PrismaAiBlogDraftSourceType,
): AiBlogDraftSourceType {
  switch (sourceType) {
    case PrismaAiBlogDraftSourceType.INTERNET_RESEARCH:
      return "internet_research";
    case PrismaAiBlogDraftSourceType.PRODUCT_NEWS:
      return "product_news";
    case PrismaAiBlogDraftSourceType.MIXED:
      return "mixed";
  }
}

function mapPrismaStatus(
  status: PrismaAiBlogDraftRunStatus,
): AiBlogDraftRunStatus {
  switch (status) {
    case PrismaAiBlogDraftRunStatus.DRAFT_CREATED:
      return "draft_created";
    case PrismaAiBlogDraftRunStatus.DRAFT_REVIEW:
      return "draft_review";
    case PrismaAiBlogDraftRunStatus.FAILED:
      return "failed";
    case PrismaAiBlogDraftRunStatus.OUTLINE_REVIEW:
      return "outline_review";
    case PrismaAiBlogDraftRunStatus.REJECTED:
      return "rejected";
    case PrismaAiBlogDraftRunStatus.TOPIC_REVIEW:
      return "topic_review";
  }
}
