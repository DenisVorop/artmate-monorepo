import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import {
  ColoringCollectionStatus as PrismaColoringCollectionStatus,
  ColoringStatus,
  Prisma,
  ProductStatus as PrismaProductStatus,
} from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";

import type {
  CreateColoringCollectionRequestDTO,
  UpdateColoringCollectionRequestDTO,
} from "./dto";
import type { ColoringCollectionStatus } from "./colorings.types";
import { publicColoringReadinessWhere } from "./public-coloring-eligibility";

const collectionInclude = {
  product: {
    select: { id: true, slug: true, title: true, status: true },
  },
  colorings: {
    select: { status: true },
  },
} satisfies Prisma.ColoringCollectionInclude;

type StoredCollection = Prisma.ColoringCollectionGetPayload<{
  include: typeof collectionInclude;
}>;

type CollectionResponse = ReturnType<
  ColoringCollectionsService["mapCollection"]
>;

@Injectable()
export class ColoringCollectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCollections(): Promise<CollectionResponse[]> {
    const collections = await this.prisma.coloringCollection.findMany({
      include: collectionInclude,
      orderBy: [{ position: "asc" }, { id: "asc" }],
    });

    return collections.map((collection) => this.mapCollection(collection));
  }

  async getCollection(collectionId: string): Promise<CollectionResponse> {
    const collection = await this.prisma.coloringCollection.findUnique({
      where: { id: collectionId },
      include: collectionInclude,
    });

    if (!collection) {
      throw this.notFound();
    }

    return this.mapCollection(collection);
  }

  async createCollection(
    input: CreateColoringCollectionRequestDTO,
  ): Promise<CollectionResponse> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const productId = this.parseRequiredString(
          input.productId,
          "productId",
        );
        const product = await tx.product.findUnique({
          where: { id: productId },
          select: { id: true },
        });

        if (!product) {
          throw new NotFoundException("Product not found");
        }

        const created = await tx.coloringCollection.create({
          data: {
            productId,
            slug: this.parseSlug(input.slug),
            title: this.parseRequiredString(input.title, "title"),
            description: input.description?.trim() || null,
            position: input.position,
            expectedColoringCount: input.expectedColoringCount,
            status: PrismaColoringCollectionStatus.DRAFT,
          },
          select: { id: true },
        });
        const collection = await tx.coloringCollection.findUnique({
          where: { id: created.id },
          include: collectionInclude,
        });

        if (!collection) {
          throw new Error("Created coloring collection could not be loaded");
        }

        return this.mapCollection(collection);
      });
    } catch (error) {
      this.handleMutationError(error);
    }
  }

  async updateCollection(
    collectionId: string,
    input: UpdateColoringCollectionRequestDTO,
  ): Promise<CollectionResponse> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const expectedUpdatedAt = new Date(input.updatedAt);
        const existing = await tx.coloringCollection.findUnique({
          where: { id: collectionId },
          select: { id: true, status: true, updatedAt: true },
        });

        if (!existing) {
          throw this.notFound();
        }

        if (existing.status !== PrismaColoringCollectionStatus.DRAFT) {
          throw new ConflictException(
            "Published or archived coloring collection metadata cannot be changed",
          );
        }

        if (
          !Number.isFinite(expectedUpdatedAt.getTime()) ||
          expectedUpdatedAt.getTime() !== existing.updatedAt.getTime()
        ) {
          throw new ConflictException("Coloring collection changed concurrently");
        }

        const data: Prisma.ColoringCollectionUncheckedUpdateInput = {};

        if (input.productId !== undefined) {
          const productId = this.parseRequiredString(
            input.productId,
            "productId",
          );
          const product = await tx.product.findUnique({
            where: { id: productId },
            select: { id: true },
          });

          if (!product) {
            throw new NotFoundException("Product not found");
          }

          data.productId = productId;
        }

        if (input.slug !== undefined) {
          data.slug = this.parseSlug(input.slug);
        }

        if (input.title !== undefined) {
          data.title = this.parseRequiredString(input.title, "title");
        }

        if (input.description !== undefined) {
          data.description = input.description?.trim() || null;
        }

        if (input.position !== undefined) {
          data.position = input.position;
        }

        if (input.expectedColoringCount !== undefined) {
          await tx.$queryRaw(
            Prisma.sql`SELECT "id"
                       FROM "coloring_collections"
                       WHERE "id" = ${collectionId}
                       FOR UPDATE`,
          );
          const highestNumber = await tx.coloring.findFirst({
            where: { collectionId },
            select: { number: true },
            orderBy: { number: "desc" },
          });

          if (
            highestNumber &&
            highestNumber.number > input.expectedColoringCount
          ) {
            throw new ConflictException(
              "Expected coloring count cannot be lower than an assigned coloring number",
            );
          }

          data.expectedColoringCount = input.expectedColoringCount;
        }

        const updated = await tx.coloringCollection.updateMany({
          where: {
            id: collectionId,
            status: PrismaColoringCollectionStatus.DRAFT,
            updatedAt: expectedUpdatedAt,
          },
          data: {
            ...data,
            updatedAt: new Date(
              Math.max(Date.now(), expectedUpdatedAt.getTime() + 1),
            ),
          },
        });

        if (updated.count !== 1) {
          throw new ConflictException("Coloring collection changed concurrently");
        }

        const collection = await tx.coloringCollection.findUnique({
          where: { id: collectionId },
          include: collectionInclude,
        });

        if (!collection) {
          throw this.notFound();
        }

        return this.mapCollection(collection);
      });
    } catch (error) {
      this.handleMutationError(error);
    }
  }

  async publishCollection(collectionId: string): Promise<CollectionResponse> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.coloringCollection.findUnique({
          where: { id: collectionId },
          select: {
            id: true,
            status: true,
            updatedAt: true,
            coverUrl: true,
            coverAlt: true,
            coverWidth: true,
            coverHeight: true,
            product: { select: { status: true } },
          },
        });

        if (!existing) {
          throw this.notFound();
        }

        if (existing.status !== PrismaColoringCollectionStatus.DRAFT) {
          throw new ConflictException(
            "Only a draft coloring collection can be published",
          );
        }

        if (existing.product.status !== PrismaProductStatus.PUBLISHED) {
          throw new ConflictException(
            "Coloring collection product must be published first",
          );
        }

        if (!this.hasCompleteCover(existing)) {
          throw new ConflictException(
            "Coloring collection cover must be uploaded before publishing",
          );
        }

        const readyColorings = await tx.coloring.findMany({
          where: {
            collectionId,
            ...publicColoringReadinessWhere,
          },
          select: { description: true },
        });

        if (
          !readyColorings.some(({ description }) => Boolean(description?.trim()))
        ) {
          throw new ConflictException(
            "Coloring collection must contain a published coloring",
          );
        }

        const publishedAt = new Date();
        const published = await tx.coloringCollection.updateMany({
          where: {
            id: collectionId,
            status: PrismaColoringCollectionStatus.DRAFT,
            updatedAt: existing.updatedAt,
          },
          data: {
            status: PrismaColoringCollectionStatus.PUBLISHED,
            publishedAt,
            updatedAt: new Date(
              Math.max(Date.now(), existing.updatedAt.getTime() + 1),
            ),
          },
        });

        if (published.count !== 1) {
          throw new ConflictException("Coloring collection changed concurrently");
        }

        const collection = await tx.coloringCollection.findUnique({
          where: { id: collectionId },
          include: collectionInclude,
        });

        if (!collection) {
          throw this.notFound();
        }

        return this.mapCollection(collection);
      });
    } catch (error) {
      this.handleMutationError(error);
    }
  }

  private mapCollection(collection: StoredCollection) {
    const publishedColoringCount = collection.colorings.filter(
      ({ status }) => status === ColoringStatus.PUBLISHED,
    ).length;

    return {
      id: collection.id,
      productId: collection.productId,
      slug: collection.slug,
      title: collection.title,
      ...(collection.description
        ? { description: collection.description }
        : {}),
      position: collection.position,
      status: this.mapCollectionStatus(collection.status),
      expectedColoringCount: collection.expectedColoringCount,
      ...(this.hasCompleteCover(collection)
        ? {
            cover: {
              url: collection.coverUrl,
              alt: collection.coverAlt,
              width: collection.coverWidth,
              height: collection.coverHeight,
            },
          }
        : {}),
      coloringCount: collection.colorings.length,
      publishedColoringCount,
      product: {
        id: collection.product.id,
        slug: collection.product.slug,
        title: collection.product.title,
        status: this.mapProductStatus(collection.product.status),
      },
      createdAt: collection.createdAt.toISOString(),
      updatedAt: collection.updatedAt.toISOString(),
      ...(collection.publishedAt
        ? { publishedAt: collection.publishedAt.toISOString() }
        : {}),
    };
  }

  private hasCompleteCover(collection: {
    coverUrl: string | null;
    coverAlt: string | null;
    coverWidth: number | null;
    coverHeight: number | null;
  }): collection is {
    coverUrl: string;
    coverAlt: string;
    coverWidth: number;
    coverHeight: number;
  } {
    return Boolean(
      collection.coverUrl?.trim() &&
      collection.coverAlt?.trim() &&
      collection.coverWidth &&
      collection.coverWidth > 0 &&
      collection.coverHeight &&
      collection.coverHeight > 0,
    );
  }

  private mapCollectionStatus(
    status: PrismaColoringCollectionStatus,
  ): ColoringCollectionStatus {
    switch (status) {
      case PrismaColoringCollectionStatus.DRAFT:
        return "draft";
      case PrismaColoringCollectionStatus.PUBLISHED:
        return "published";
      case PrismaColoringCollectionStatus.ARCHIVED:
        return "archived";
      default: {
        const exhaustiveStatus: never = status;

        return exhaustiveStatus;
      }
    }
  }

  private mapProductStatus(status: PrismaProductStatus) {
    switch (status) {
      case PrismaProductStatus.DRAFT:
        return "draft" as const;
      case PrismaProductStatus.PUBLISHED:
        return "published" as const;
      case PrismaProductStatus.ARCHIVED:
        return "archived" as const;
      default: {
        const exhaustiveStatus: never = status;

        return exhaustiveStatus;
      }
    }
  }

  private parseSlug(value: string) {
    const slug = this.parseRequiredString(value, "slug");

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw new BadRequestException("slug has an invalid format");
    }

    return slug;
  }

  private parseRequiredString(value: string, field: string) {
    const trimmed = value.trim();

    if (!trimmed) {
      throw new BadRequestException(`${field} must be a non-empty string`);
    }

    return trimmed;
  }

  private notFound() {
    return new NotFoundException("Coloring collection not found");
  }

  private handleMutationError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const target = Array.isArray(error.meta?.target)
        ? error.meta.target.map(String)
        : [String(error.meta?.target ?? "")];

      if (target.some((field) => field.includes("product"))) {
        throw new ConflictException(
          "A coloring collection already exists for this product",
        );
      }

      if (target.some((field) => field.includes("slug"))) {
        throw new ConflictException("Coloring collection slug already exists");
      }

      throw new ConflictException("Coloring collection already exists");
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      throw new ConflictException("Coloring collection product no longer exists");
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw this.notFound();
    }

    throw error;
  }
}
