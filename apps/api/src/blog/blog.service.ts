import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import {
  BlogPostStatus as PrismaBlogPostStatus,
  Prisma,
} from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";

import type {
  BlogPostContent,
  BlogPostBlock,
  BlogPostHighlightItem,
  BlogPostStatus,
  BlogPostStepItem,
} from "./blog.types";
import {
  type CreateBlogAuthorRequestDTO,
  type CreateBlogCategoryRequestDTO,
  type CreateBlogPostRequestDTO,
  type CreateBlogTagRequestDTO,
  type UpdateBlogAuthorRequestDTO,
  type UpdateBlogCategoryRequestDTO,
  type UpdateBlogPostRequestDTO,
  type UpdateBlogTagRequestDTO,
} from "./dto";

const blogPostInclude = {
  author: true,
  category: true,
  tags: {
    include: {
      tag: true,
    },
    orderBy: {
      sortOrder: "asc",
    },
  },
} satisfies Prisma.BlogPostInclude;

const blogPostOrderBy = [
  {
    publishedAt: {
      sort: "desc",
      nulls: "last",
    },
  },
  {
    updatedAt: "desc",
  },
] satisfies Prisma.BlogPostOrderByWithRelationInput[];

const maxContentBlocks = 80;
const maxContentItems = 24;

type StoredBlogPost = Prisma.BlogPostGetPayload<{
  include: typeof blogPostInclude;
}>;

type StoredBlogAuthor = {
  id: string;
  slug: string;
  name: string;
  role: string | null;
  avatar: string | null;
  image: string | null;
  bio: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type StoredBlogCategory = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type StoredBlogTag = {
  id: string;
  slug: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class BlogService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublishedPosts() {
    const posts = await this.prisma.blogPost.findMany({
      where: {
        status: PrismaBlogPostStatus.PUBLISHED,
      },
      include: blogPostInclude,
      orderBy: blogPostOrderBy,
    });

    return posts.map((post) => this.mapPost(post));
  }

  async getPublishedPostBySlug(slug: string) {
    const post = await this.prisma.blogPost.findFirst({
      where: {
        slug,
        status: PrismaBlogPostStatus.PUBLISHED,
      },
      include: blogPostInclude,
    });

    if (!post) {
      throw new NotFoundException("Blog post not found");
    }

    return this.mapPost(post);
  }

  async getAdminPosts() {
    const posts = await this.prisma.blogPost.findMany({
      include: blogPostInclude,
      orderBy: blogPostOrderBy,
    });

    return posts.map((post) => this.mapPost(post));
  }

  async getAdminPost(postId: string) {
    const post = await this.prisma.blogPost.findUnique({
      where: { id: postId },
      include: blogPostInclude,
    });

    if (!post) {
      throw new NotFoundException("Blog post not found");
    }

    return this.mapPost(post);
  }

  async createPost(input: CreateBlogPostRequestDTO, createdById: string) {
    const status = input.status
      ? this.mapPostStatus(input.status)
      : PrismaBlogPostStatus.DRAFT;
    const tagIds = this.normalizeTagIds(input.tagIds);

    try {
      const post = await this.prisma.blogPost.create({
        data: {
          title: this.parseRequiredString(input.title, "title", 220),
          slug: this.parseSlug(input.slug),
          excerpt: this.parseRequiredString(input.excerpt, "excerpt", 12000),
          status,
          featured: input.featured ?? false,
          readTimeMinutes: this.parseReadTimeMinutes(input.readTimeMinutes),
          imageUrl: this.parseOptionalString(input.imageUrl, "imageUrl", 2048),
          imageAlt: this.parseOptionalString(input.imageAlt, "imageAlt", 220),
          metaTitle: this.parseOptionalString(input.metaTitle, "metaTitle", 220),
          metaDescription: this.parseOptionalString(
            input.metaDescription,
            "metaDescription",
            12000,
          ),
          publishedAt: this.getPublishedAtForCreate(status, input.publishedAt),
          content: this.getJsonContent(input.content),
          author: {
            connect: {
              id: this.parseRequiredString(input.authorId, "authorId", 32),
            },
          },
          category: {
            connect: {
              id: this.parseRequiredString(input.categoryId, "categoryId", 32),
            },
          },
          createdBy: {
            connect: {
              id: createdById,
            },
          },
          tags: {
            create: tagIds.map((tagId, index) => ({
              sortOrder: index,
              tag: {
                connect: {
                  id: tagId,
                },
              },
            })),
          },
        },
        include: blogPostInclude,
      });

      return this.mapPost(post);
    } catch (error) {
      this.handlePrismaMutationError(error, "Blog post slug already exists");
    }
  }

  async updatePost(postId: string, input: UpdateBlogPostRequestDTO) {
    const data: Prisma.BlogPostUpdateInput = {};

    if (input.title !== undefined) {
      data.title = this.parseRequiredString(input.title, "title", 220);
    }

    if (input.slug !== undefined) {
      data.slug = this.parseSlug(input.slug);
    }

    if (input.excerpt !== undefined) {
      data.excerpt = this.parseRequiredString(input.excerpt, "excerpt", 12000);
    }

    if (input.status !== undefined) {
      data.status = this.mapPostStatus(input.status);
    }

    if (input.featured !== undefined) {
      data.featured = input.featured;
    }

    if (input.readTimeMinutes !== undefined) {
      data.readTimeMinutes = this.parseReadTimeMinutes(input.readTimeMinutes);
    }

    if (input.imageUrl !== undefined) {
      data.imageUrl =
        this.parseOptionalString(input.imageUrl, "imageUrl", 2048) ?? null;
    }

    if (input.imageAlt !== undefined) {
      data.imageAlt =
        this.parseOptionalString(input.imageAlt, "imageAlt", 220) ?? null;
    }

    if (input.metaTitle !== undefined) {
      data.metaTitle =
        this.parseOptionalString(input.metaTitle, "metaTitle", 220) ?? null;
    }

    if (input.metaDescription !== undefined) {
      data.metaDescription =
        this.parseOptionalString(
          input.metaDescription,
          "metaDescription",
          12000,
        ) ?? null;
    }

    if (input.publishedAt !== undefined) {
      data.publishedAt = this.parseOptionalDate(input.publishedAt);
    }

    if (input.content !== undefined) {
      data.content = this.getJsonContent(input.content);
    }

    if (input.authorId !== undefined) {
      data.author = {
        connect: {
          id: this.parseRequiredString(input.authorId, "authorId", 32),
        },
      };
    }

    if (input.categoryId !== undefined) {
      data.category =
        input.categoryId === null
          ? {
              disconnect: true,
            }
          : {
              connect: {
                id: this.parseRequiredString(input.categoryId, "categoryId", 32),
              },
            };
    }

    if (
      input.status === "published" &&
      (input.publishedAt === undefined || input.publishedAt === null)
    ) {
      data.publishedAt = await this.getPublishedAtForUpdate(postId);
    }

    const tagIds =
      input.tagIds === undefined ? undefined : this.normalizeTagIds(input.tagIds);

    try {
      const post = await this.prisma.$transaction(async (transaction) => {
        await transaction.blogPost.update({
          where: { id: postId },
          data,
        });

        if (tagIds !== undefined) {
          await transaction.blogPostTag.deleteMany({
            where: { postId },
          });

          if (tagIds.length > 0) {
            await transaction.blogPostTag.createMany({
              data: tagIds.map((tagId, index) => ({
                postId,
                tagId,
                sortOrder: index,
              })),
            });
          }
        }

        return transaction.blogPost.findUniqueOrThrow({
          where: { id: postId },
          include: blogPostInclude,
        });
      });

      return this.mapPost(post);
    } catch (error) {
      this.handlePrismaMutationError(error, "Blog post slug already exists");
    }
  }

  async deletePost(postId: string) {
    const post = await this.prisma.blogPost.findUnique({
      where: { id: postId },
      include: blogPostInclude,
    });

    if (!post) {
      throw new NotFoundException("Blog post not found");
    }

    await this.prisma.blogPost.delete({
      where: { id: postId },
    });

    return this.mapPost(post);
  }

  async getAuthors() {
    const authors = await this.prisma.blogAuthor.findMany({
      orderBy: {
        name: "asc",
      },
    });

    return authors.map((author) => this.mapAuthor(author));
  }

  async createAuthor(input: CreateBlogAuthorRequestDTO) {
    try {
      const author = await this.prisma.blogAuthor.create({
        data: {
          slug: this.parseSlug(input.slug),
          name: this.parseRequiredString(input.name, "name", 120),
          role: this.parseOptionalString(input.role, "role", 160),
          avatar: this.parseOptionalString(input.avatar, "avatar", 40),
          image: this.parseOptionalString(input.image, "image", 2048),
          bio: this.parseOptionalString(input.bio, "bio", 12000),
        },
      });

      return this.mapAuthor(author);
    } catch (error) {
      this.handlePrismaMutationError(error, "Blog author slug already exists");
    }
  }

  async updateAuthor(authorId: string, input: UpdateBlogAuthorRequestDTO) {
    const data: Prisma.BlogAuthorUpdateInput = {};

    if (input.slug !== undefined) {
      data.slug = this.parseSlug(input.slug);
    }

    if (input.name !== undefined) {
      data.name = this.parseRequiredString(input.name, "name", 120);
    }

    if (input.role !== undefined) {
      data.role = this.parseOptionalString(input.role, "role", 160) ?? null;
    }

    if (input.avatar !== undefined) {
      data.avatar =
        this.parseOptionalString(input.avatar, "avatar", 40) ?? null;
    }

    if (input.image !== undefined) {
      data.image =
        this.parseOptionalString(input.image, "image", 2048) ?? null;
    }

    if (input.bio !== undefined) {
      data.bio = this.parseOptionalString(input.bio, "bio", 12000) ?? null;
    }

    try {
      const author = await this.prisma.blogAuthor.update({
        where: { id: authorId },
        data,
      });

      return this.mapAuthor(author);
    } catch (error) {
      this.handlePrismaMutationError(error, {
        duplicateMessage: "Blog author slug already exists",
        notFoundMessage: "Blog author not found",
      });
    }
  }

  async deleteAuthor(authorId: string) {
    const author = await this.prisma.blogAuthor.findUnique({
      where: { id: authorId },
    });

    if (!author) {
      throw new NotFoundException("Blog author not found");
    }

    try {
      await this.prisma.blogAuthor.delete({
        where: { id: authorId },
      });

      return this.mapAuthor(author);
    } catch (error) {
      this.handlePrismaMutationError(error, {
        duplicateMessage: "Blog author slug already exists",
        notFoundMessage: "Blog author not found",
        relationMessage: "Blog author is used by existing posts",
      });
    }
  }

  async getCategories() {
    const categories = await this.prisma.blogCategory.findMany({
      orderBy: {
        title: "asc",
      },
    });

    return categories.map((category) => this.mapCategory(category));
  }

  async createCategory(input: CreateBlogCategoryRequestDTO) {
    try {
      const category = await this.prisma.blogCategory.create({
        data: {
          slug: this.parseSlug(input.slug),
          title: this.parseRequiredString(input.title, "title", 120),
          description: this.parseOptionalString(
            input.description,
            "description",
            12000,
          ),
        },
      });

      return this.mapCategory(category);
    } catch (error) {
      this.handlePrismaMutationError(error, "Blog category slug already exists");
    }
  }

  async updateCategory(
    categoryId: string,
    input: UpdateBlogCategoryRequestDTO,
  ) {
    const data: Prisma.BlogCategoryUpdateInput = {};

    if (input.slug !== undefined) {
      data.slug = this.parseSlug(input.slug);
    }

    if (input.title !== undefined) {
      data.title = this.parseRequiredString(input.title, "title", 120);
    }

    if (input.description !== undefined) {
      data.description =
        this.parseOptionalString(input.description, "description", 12000) ??
        null;
    }

    try {
      const category = await this.prisma.blogCategory.update({
        where: { id: categoryId },
        data,
      });

      return this.mapCategory(category);
    } catch (error) {
      this.handlePrismaMutationError(error, {
        duplicateMessage: "Blog category slug already exists",
        notFoundMessage: "Blog category not found",
      });
    }
  }

  async deleteCategory(categoryId: string) {
    const category = await this.prisma.blogCategory.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      throw new NotFoundException("Blog category not found");
    }

    try {
      await this.prisma.blogCategory.delete({
        where: { id: categoryId },
      });

      return this.mapCategory(category);
    } catch (error) {
      this.handlePrismaMutationError(error, {
        duplicateMessage: "Blog category slug already exists",
        notFoundMessage: "Blog category not found",
        relationMessage: "Blog category is used by existing posts",
      });
    }
  }

  async getTags() {
    const tags = await this.prisma.blogTag.findMany({
      orderBy: {
        title: "asc",
      },
    });

    return tags.map((tag) => this.mapTag(tag));
  }

  async createTag(input: CreateBlogTagRequestDTO) {
    try {
      const tag = await this.prisma.blogTag.create({
        data: {
          slug: this.parseSlug(input.slug),
          title: this.parseRequiredString(input.title, "title", 120),
        },
      });

      return this.mapTag(tag);
    } catch (error) {
      this.handlePrismaMutationError(error, "Blog tag slug already exists");
    }
  }

  async updateTag(tagId: string, input: UpdateBlogTagRequestDTO) {
    const data: Prisma.BlogTagUpdateInput = {};

    if (input.slug !== undefined) {
      data.slug = this.parseSlug(input.slug);
    }

    if (input.title !== undefined) {
      data.title = this.parseRequiredString(input.title, "title", 120);
    }

    try {
      const tag = await this.prisma.blogTag.update({
        where: { id: tagId },
        data,
      });

      return this.mapTag(tag);
    } catch (error) {
      this.handlePrismaMutationError(error, {
        duplicateMessage: "Blog tag slug already exists",
        notFoundMessage: "Blog tag not found",
      });
    }
  }

  async deleteTag(tagId: string) {
    const tag = await this.prisma.blogTag.findUnique({
      where: { id: tagId },
    });

    if (!tag) {
      throw new NotFoundException("Blog tag not found");
    }

    try {
      await this.prisma.blogTag.delete({
        where: { id: tagId },
      });

      return this.mapTag(tag);
    } catch (error) {
      this.handlePrismaMutationError(error, {
        duplicateMessage: "Blog tag slug already exists",
        notFoundMessage: "Blog tag not found",
        relationMessage: "Blog tag is used by existing posts",
      });
    }
  }

  private getPublishedAtForCreate(
    status: PrismaBlogPostStatus,
    publishedAt: string | null | undefined,
  ) {
    const parsedPublishedAt = this.parseOptionalDate(publishedAt);

    if (status === PrismaBlogPostStatus.PUBLISHED) {
      return parsedPublishedAt ?? new Date();
    }

    return parsedPublishedAt;
  }

  private async getPublishedAtForUpdate(postId: string) {
    const post = await this.prisma.blogPost.findUnique({
      where: { id: postId },
      select: {
        publishedAt: true,
      },
    });

    if (!post) {
      throw new NotFoundException("Blog post not found");
    }

    return post.publishedAt ?? new Date();
  }

  private parseRequiredString(value: string, field: string, maxLength: number) {
    const trimmed = value.trim();

    if (!trimmed) {
      throw new BadRequestException(`${field} must be a non-empty string`);
    }

    if (trimmed.length > maxLength) {
      throw new BadRequestException(
        `${field} must be at most ${maxLength} characters`,
      );
    }

    return trimmed;
  }

  private parseOptionalString(
    value: string | null | undefined,
    field: string,
    maxLength: number,
  ) {
    if (value === null || value === undefined) {
      return undefined;
    }

    const trimmed = value.trim();

    if (!trimmed) {
      return undefined;
    }

    if (trimmed.length > maxLength) {
      throw new BadRequestException(
        `${field} must be at most ${maxLength} characters`,
      );
    }

    return trimmed;
  }

  private parseSlug(value: string) {
    const slug = this.parseRequiredString(value, "slug", 180).toLowerCase();

    if (!/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(slug)) {
      throw new BadRequestException(
        "slug must contain latin letters, numbers, hyphens or underscores",
      );
    }

    return slug;
  }

  private parseReadTimeMinutes(value: number | null | undefined) {
    if (value === null || value === undefined) {
      return null;
    }

    if (!Number.isSafeInteger(value) || value < 1 || value > 1440) {
      throw new BadRequestException(
        "readTimeMinutes must be an integer from 1 to 1440",
      );
    }

    return value;
  }

  private parseOptionalDate(value: string | null | undefined) {
    if (value === null || value === undefined) {
      return null;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException("publishedAt must be a valid ISO date");
    }

    return date;
  }

  private normalizeTagIds(tagIds: readonly string[] | undefined) {
    return Array.from(
      new Set(
        tagIds?.map((tagId) =>
          this.parseRequiredString(tagId, "tagId", 32),
        ) ?? [],
      ),
    );
  }

  private getJsonContent(value: unknown) {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return Prisma.JsonNull;
    }

    return this.parseContent(value) as Prisma.InputJsonValue;
  }

  private parseContent(value: unknown): BlogPostContent {
    const content = this.requireRecord(value, "content");
    this.assertKeys(content, ["schemaVersion", "blocks"], "content");

    if (content.schemaVersion !== 1) {
      throw new BadRequestException("content.schemaVersion must be 1");
    }

    if (!Array.isArray(content.blocks)) {
      throw new BadRequestException("content.blocks must be an array");
    }

    if (content.blocks.length > maxContentBlocks) {
      throw new BadRequestException(
        `content.blocks must contain at most ${maxContentBlocks} blocks`,
      );
    }

    return {
      schemaVersion: 1,
      blocks: content.blocks.map((block, index) =>
        this.parseContentBlock(block, `content.blocks.${index}`),
      ),
    };
  }

  private parseContentBlock(value: unknown, path: string): BlogPostBlock {
    const block = this.requireRecord(value, path);
    const type = this.readRequiredString(block, "type", path, 32);

    switch (type) {
      case "heading": {
        this.assertKeys(block, ["id", "type", "level", "text", "anchor"], path);

        if (block.level !== 2 && block.level !== 3) {
          throw new BadRequestException(`${path}.level must be 2 or 3`);
        }

        const anchor = this.readOptionalString(block, "anchor", path, 120);

        return {
          id: this.readBlockId(block, path),
          type,
          level: block.level,
          text: this.readRequiredString(block, "text", path, 220),
          ...(anchor ? { anchor } : {}),
        };
      }
      case "paragraph":
        this.assertKeys(block, ["id", "type", "text"], path);

        return {
          id: this.readBlockId(block, path),
          type,
          text: this.readRequiredString(block, "text", path, 4000),
        };
      case "image": {
        this.assertKeys(block, ["id", "type", "src", "alt", "caption"], path);

        const caption = this.readOptionalString(block, "caption", path, 220);

        return {
          id: this.readBlockId(block, path),
          type,
          src: this.readRequiredString(block, "src", path, 2048),
          alt: this.readRequiredString(block, "alt", path, 220),
          ...(caption ? { caption } : {}),
        };
      }
      case "quote": {
        this.assertKeys(block, ["id", "type", "text", "author"], path);

        const author = this.readOptionalString(block, "author", path, 160);

        return {
          id: this.readBlockId(block, path),
          type,
          text: this.readRequiredString(block, "text", path, 1200),
          ...(author ? { author } : {}),
        };
      }
      case "highlights":
        this.assertKeys(block, ["id", "type", "items"], path);

        return {
          id: this.readBlockId(block, path),
          type,
          items: this.readItems(block, "items", path, (item, itemPath) =>
            this.parseHighlightItem(item, itemPath),
          ),
        };
      case "steps":
        this.assertKeys(block, ["id", "type", "items"], path);

        return {
          id: this.readBlockId(block, path),
          type,
          items: this.readItems(block, "items", path, (item, itemPath) =>
            this.parseStepItem(item, itemPath),
          ),
        };
      case "cta":
        this.assertKeys(
          block,
          ["id", "type", "title", "description", "href", "label"],
          path,
        );

        return {
          id: this.readBlockId(block, path),
          type,
          title: this.readRequiredString(block, "title", path, 160),
          description: this.readRequiredString(block, "description", path, 600),
          href: this.readRequiredString(block, "href", path, 2048),
          label: this.readRequiredString(block, "label", path, 80),
        };
      default:
        throw new BadRequestException(`${path}.type is not supported`);
    }
  }

  private parseHighlightItem(
    value: unknown,
    path: string,
  ): BlogPostHighlightItem {
    const item = this.requireRecord(value, path);
    this.assertKeys(item, ["title", "description", "emoji"], path);

    const emoji = this.readOptionalString(item, "emoji", path, 16);

    return {
      title: this.readRequiredString(item, "title", path, 160),
      description: this.readRequiredString(item, "description", path, 600),
      ...(emoji ? { emoji } : {}),
    };
  }

  private parseStepItem(value: unknown, path: string): BlogPostStepItem {
    const item = this.requireRecord(value, path);
    this.assertKeys(item, ["title", "description"], path);

    return {
      title: this.readRequiredString(item, "title", path, 160),
      description: this.readRequiredString(item, "description", path, 800),
    };
  }

  private readItems<T>(
    record: Record<string, unknown>,
    field: string,
    path: string,
    parser: (value: unknown, path: string) => T,
  ) {
    const items = record[field];
    const itemPath = `${path}.${field}`;

    if (!Array.isArray(items)) {
      throw new BadRequestException(`${itemPath} must be an array`);
    }

    if (items.length === 0 || items.length > maxContentItems) {
      throw new BadRequestException(
        `${itemPath} must contain from 1 to ${maxContentItems} items`,
      );
    }

    return items.map((item, index) => parser(item, `${itemPath}.${index}`));
  }

  private readBlockId(record: Record<string, unknown>, path: string) {
    return this.readRequiredString(record, "id", path, 80);
  }

  private readRequiredString(
    record: Record<string, unknown>,
    field: string,
    path: string,
    maxLength: number,
  ) {
    const value = record[field];

    if (typeof value !== "string") {
      throw new BadRequestException(`${path}.${field} must be a string`);
    }

    return this.parseRequiredString(value, `${path}.${field}`, maxLength);
  }

  private readOptionalString(
    record: Record<string, unknown>,
    field: string,
    path: string,
    maxLength: number,
  ) {
    if (record[field] === undefined) {
      return undefined;
    }

    if (typeof record[field] !== "string") {
      throw new BadRequestException(`${path}.${field} must be a string`);
    }

    return this.parseOptionalString(record[field], `${path}.${field}`, maxLength);
  }

  private requireRecord(value: unknown, path: string): Record<string, unknown> {
    if (!this.isRecord(value)) {
      throw new BadRequestException(`${path} must be an object`);
    }

    return value;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private assertKeys(
    record: Record<string, unknown>,
    allowedKeys: readonly string[],
    path: string,
  ) {
    const allowed = new Set(allowedKeys);
    const unknownKey = Object.keys(record).find((key) => !allowed.has(key));

    if (unknownKey) {
      throw new BadRequestException(`${path}.${unknownKey} is not supported`);
    }
  }

  private mapPostStatus(status: BlogPostStatus) {
    switch (status) {
      case "draft":
        return PrismaBlogPostStatus.DRAFT;
      case "published":
        return PrismaBlogPostStatus.PUBLISHED;
      case "archived":
        return PrismaBlogPostStatus.ARCHIVED;
    }
  }

  private mapPrismaPostStatus(status: PrismaBlogPostStatus): BlogPostStatus {
    switch (status) {
      case PrismaBlogPostStatus.DRAFT:
        return "draft";
      case PrismaBlogPostStatus.PUBLISHED:
        return "published";
      case PrismaBlogPostStatus.ARCHIVED:
        return "archived";
    }
  }

  private mapContent(value: Prisma.JsonValue | null): BlogPostContent | null {
    if (!value) {
      return null;
    }

    try {
      return this.parseContent(value);
    } catch {
      return null;
    }
  }

  private mapPost(post: StoredBlogPost) {
    return {
      id: post.id,
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      status: this.mapPrismaPostStatus(post.status),
      featured: post.featured,
      readTimeMinutes: post.readTimeMinutes ?? undefined,
      imageUrl: post.imageUrl ?? undefined,
      imageAlt: post.imageAlt ?? undefined,
      metaTitle: post.metaTitle ?? undefined,
      metaDescription: post.metaDescription ?? undefined,
      publishedAt: post.publishedAt?.toISOString(),
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      authorId: post.authorId,
      categoryId: post.categoryId ?? undefined,
      author: this.mapAuthor(post.author),
      category: post.category ? this.mapCategory(post.category) : undefined,
      tags: post.tags.map((postTag) => this.mapTag(postTag.tag)),
      content: this.mapContent(post.content),
    };
  }

  private mapAuthor(author: StoredBlogAuthor) {
    return {
      id: author.id,
      slug: author.slug,
      name: author.name,
      role: author.role ?? undefined,
      avatar: author.avatar ?? undefined,
      image: author.image ?? undefined,
      bio: author.bio ?? undefined,
      createdAt: author.createdAt.toISOString(),
      updatedAt: author.updatedAt.toISOString(),
    };
  }

  private mapCategory(category: StoredBlogCategory) {
    return {
      id: category.id,
      slug: category.slug,
      title: category.title,
      description: category.description ?? undefined,
      createdAt: category.createdAt.toISOString(),
      updatedAt: category.updatedAt.toISOString(),
    };
  }

  private mapTag(tag: StoredBlogTag) {
    return {
      id: tag.id,
      slug: tag.slug,
      title: tag.title,
      createdAt: tag.createdAt.toISOString(),
      updatedAt: tag.updatedAt.toISOString(),
    };
  }

  private handlePrismaMutationError(
    error: unknown,
    options:
      | string
      | {
          readonly duplicateMessage: string;
          readonly notFoundMessage?: string;
          readonly relationMessage?: string;
        },
  ): never {
    const {
      duplicateMessage,
      notFoundMessage = "Blog post not found",
      relationMessage = "Blog post relation not found",
    } =
      typeof options === "string"
        ? {
            duplicateMessage: options,
          }
        : options;

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        throw new BadRequestException(duplicateMessage);
      }

      if (error.code === "P2003") {
        throw new ConflictException(relationMessage);
      }

      if (error.code === "P2025") {
        throw new NotFoundException(notFoundMessage);
      }
    }

    throw error;
  }
}
