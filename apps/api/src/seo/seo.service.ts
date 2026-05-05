import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import Mustache from "mustache";

import {
  Prisma,
  ProductStatus as PrismaProductStatus,
  SeoEntryStatus as PrismaSeoEntryStatus,
  SeoSnapshotKind as PrismaSeoSnapshotKind,
} from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";

import type {
  CreateSeoEntryRequestDTO,
  PublishSeoEntryRequestDTO,
  RollbackSeoEntryRequestDTO,
  UpdateSeoEntryRequestDTO,
} from "./dto";
import type {
  SeoEntryStatus,
  SeoJsonObject,
  SeoPayload,
  SeoSnapshotKind,
} from "./seo.types";

const seoEntryInclude = {
  snapshots: {
    orderBy: {
      version: "desc",
    },
  },
} satisfies Prisma.SeoEntryInclude;

type StoredSeoEntry = Prisma.SeoEntryGetPayload<{
  include: typeof seoEntryInclude;
}>;

type StoredSeoSnapshot = StoredSeoEntry["snapshots"][number];

@Injectable()
export class SeoService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(path: string) {
    const normalizedPath = this.normalizePath(path);
    const entry = await this.prisma.seoEntry.findUnique({
      where: {
        path: normalizedPath,
      },
      include: seoEntryInclude,
    });

    if (!entry?.publishedSnapshotId) {
      return {
        path: normalizedPath,
        found: false,
      };
    }

    const snapshot = this.getSnapshot(entry, entry.publishedSnapshotId);

    if (!snapshot) {
      return {
        path: normalizedPath,
        found: false,
      };
    }

    const source = this.asJsonObject(entry.source);
    const context = await this.getTemplateContext(entry, source);
    const metadata = this.renderPayload(snapshot.payload, context);

    return {
      path: normalizedPath,
      found: true,
      source,
      metadata,
    };
  }

  async getEntries() {
    const entries = await this.prisma.seoEntry.findMany({
      include: seoEntryInclude,
      orderBy: {
        updatedAt: "desc",
      },
    });

    return entries.map((entry) => this.mapEntry(entry));
  }

  async getEntry(entryId: string) {
    const entry = await this.prisma.seoEntry.findUnique({
      where: {
        id: entryId,
      },
      include: seoEntryInclude,
    });

    if (!entry) {
      throw new NotFoundException("SEO entry not found");
    }

    return this.mapEntry(entry);
  }

  async getSnapshots(entryId: string) {
    await this.ensureEntry(entryId);

    const snapshots = await this.prisma.seoSnapshot.findMany({
      where: {
        entryId,
      },
      orderBy: {
        version: "desc",
      },
    });

    return snapshots.map((snapshot) => this.mapSnapshot(snapshot));
  }

  async createEntry(input: CreateSeoEntryRequestDTO, createdById: string) {
    const path = this.normalizePath(input.path);
    const source = this.normalizeJsonObject(input.source ?? {}, "source");
    const payload = this.normalizePayload(input.payload);
    const comment = this.parseOptionalString(input.comment);

    try {
      const entry = await this.prisma.$transaction(async (tx) => {
        const createdEntry = await tx.seoEntry.create({
          data: {
            path,
            source: this.toPrismaJson(source),
            createdById,
            updatedById: createdById,
          },
        });
        const snapshot = await tx.seoSnapshot.create({
          data: {
            entryId: createdEntry.id,
            version: 1,
            kind: PrismaSeoSnapshotKind.DRAFT,
            payload: this.toPrismaJson(payload),
            comment,
            createdById,
          },
        });

        return tx.seoEntry.update({
          where: {
            id: createdEntry.id,
          },
          data: {
            draftSnapshotId: snapshot.id,
            status: PrismaSeoEntryStatus.DRAFT,
          },
          include: seoEntryInclude,
        });
      });

      return this.mapEntry(entry);
    } catch (error) {
      this.handlePrismaMutationError(error, "SEO path already exists");
    }
  }

  async updateEntry(
    entryId: string,
    input: UpdateSeoEntryRequestDTO,
    updatedById: string,
  ) {
    try {
      const entry = await this.prisma.$transaction(async (tx) => {
        const existingEntry = await tx.seoEntry.findUnique({
          where: {
            id: entryId,
          },
          include: seoEntryInclude,
        });

        if (!existingEntry) {
          throw new NotFoundException("SEO entry not found");
        }

        const data: Prisma.SeoEntryUpdateInput = {
          updatedById,
        };

        if (input.path !== undefined) {
          data.path = this.normalizePath(input.path);
        }

        if (input.source !== undefined) {
          data.source = this.toPrismaJson(
            this.normalizeJsonObject(input.source ?? {}, "source"),
          );
        }

        if (input.payload !== undefined) {
          const snapshot = await tx.seoSnapshot.create({
            data: {
              entryId,
              version: this.getNextSnapshotVersion(existingEntry),
              kind: PrismaSeoSnapshotKind.DRAFT,
              payload: this.toPrismaJson(this.normalizePayload(input.payload)),
              comment: this.parseOptionalString(input.comment),
              createdById: updatedById,
            },
          });

          data.draftSnapshotId = snapshot.id;
          data.status = PrismaSeoEntryStatus.DRAFT;
        }

        return tx.seoEntry.update({
          where: {
            id: entryId,
          },
          data,
          include: seoEntryInclude,
        });
      });

      return this.mapEntry(entry);
    } catch (error) {
      this.handlePrismaMutationError(error, "SEO path already exists");
    }
  }

  async publishEntry(
    entryId: string,
    input: PublishSeoEntryRequestDTO,
    publishedById: string,
  ) {
    const publishedAt = new Date();
    const entry = await this.prisma.$transaction(async (tx) => {
      const existingEntry = await tx.seoEntry.findUnique({
        where: {
          id: entryId,
        },
        include: seoEntryInclude,
      });

      if (!existingEntry) {
        throw new NotFoundException("SEO entry not found");
      }

      const payload =
        input.payload !== undefined
          ? this.normalizePayload(input.payload)
          : this.getPublishCandidatePayload(existingEntry);
      const snapshot = await tx.seoSnapshot.create({
        data: {
          entryId,
          version: this.getNextSnapshotVersion(existingEntry),
          kind: PrismaSeoSnapshotKind.PUBLISHED,
          payload: this.toPrismaJson(payload),
          comment: this.parseOptionalString(input.comment),
          createdById: publishedById,
          publishedAt,
        },
      });

      return tx.seoEntry.update({
        where: {
          id: entryId,
        },
        data: {
          draftSnapshotId: null,
          publishedSnapshotId: snapshot.id,
          status: PrismaSeoEntryStatus.PUBLISHED,
          updatedById: publishedById,
        },
        include: seoEntryInclude,
      });
    });

    return this.mapEntry(entry);
  }

  async rollbackEntry(
    entryId: string,
    input: RollbackSeoEntryRequestDTO,
    createdById: string,
  ) {
    const entry = await this.prisma.$transaction(async (tx) => {
      const existingEntry = await tx.seoEntry.findUnique({
        where: {
          id: entryId,
        },
        include: seoEntryInclude,
      });

      if (!existingEntry) {
        throw new NotFoundException("SEO entry not found");
      }

      const rollbackSnapshot = this.getSnapshot(existingEntry, input.snapshotId);

      if (!rollbackSnapshot) {
        throw new NotFoundException("SEO snapshot not found");
      }

      const snapshot = await tx.seoSnapshot.create({
        data: {
          entryId,
          version: this.getNextSnapshotVersion(existingEntry),
          kind: PrismaSeoSnapshotKind.DRAFT,
          payload: this.toPrismaJson(this.normalizePayload(rollbackSnapshot.payload)),
          comment:
            this.parseOptionalString(input.comment) ??
            `Rollback to v${rollbackSnapshot.version}`,
          createdById,
        },
      });

      return tx.seoEntry.update({
        where: {
          id: entryId,
        },
        data: {
          draftSnapshotId: snapshot.id,
          status: PrismaSeoEntryStatus.DRAFT,
          updatedById: createdById,
        },
        include: seoEntryInclude,
      });
    });

    return this.mapEntry(entry);
  }

  async deleteEntry(entryId: string) {
    try {
      const entry = await this.prisma.seoEntry.delete({
        where: {
          id: entryId,
        },
        include: seoEntryInclude,
      });

      return this.mapEntry(entry);
    } catch (error) {
      this.handlePrismaMutationError(error, "SEO path already exists");
    }
  }

  private async ensureEntry(entryId: string) {
    const entry = await this.prisma.seoEntry.findUnique({
      where: {
        id: entryId,
      },
      select: {
        id: true,
      },
    });

    if (!entry) {
      throw new NotFoundException("SEO entry not found");
    }
  }

  private getPublishCandidatePayload(entry: StoredSeoEntry) {
    const snapshot =
      (entry.draftSnapshotId ? this.getSnapshot(entry, entry.draftSnapshotId) : undefined) ??
      (entry.publishedSnapshotId
        ? this.getSnapshot(entry, entry.publishedSnapshotId)
        : undefined);

    if (!snapshot) {
      throw new BadRequestException("SEO entry has no snapshot to publish");
    }

    return this.normalizePayload(snapshot.payload);
  }

  private getNextSnapshotVersion(entry: StoredSeoEntry) {
    return (entry.snapshots[0]?.version ?? 0) + 1;
  }

  private getSnapshot(entry: StoredSeoEntry, snapshotId: string) {
    return entry.snapshots.find((snapshot) => snapshot.id === snapshotId);
  }

  private async getTemplateContext(
    entry: StoredSeoEntry,
    source: SeoJsonObject,
  ): Promise<SeoJsonObject> {
    const context: SeoJsonObject = {
      path: entry.path,
      site: {
        name: "Artmate",
        url: this.getSiteUrl(),
      },
      source,
    };
    const kind = this.getStringValue(source.kind);
    const productId = this.getStringValue(source.productId);
    const categoryId = this.getStringValue(source.categoryId);

    if (kind === "product" && productId) {
      const product = await this.getProductContext(productId);

      if (product) {
        context.product = product.product;

        if (product.category) {
          context.category = product.category;
        }
      }
    }

    if (!context.category && categoryId) {
      const category = await this.getCategoryContext(categoryId);

      if (category) {
        context.category = category;
      }
    }

    return context;
  }

  private async getProductContext(productId: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        status: PrismaProductStatus.PUBLISHED,
      },
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
        },
      },
    });

    if (!product) {
      return undefined;
    }

    const primaryImage = product.images[0];
    const category = product.category
      ? {
          id: product.category.id,
          slug: product.category.slug,
          title: product.category.title,
          image: product.category.image ?? undefined,
        }
      : undefined;

    return {
      product: {
        id: product.id,
        slug: product.slug,
        title: product.title,
        description: product.description ?? undefined,
        price: product.price,
        priceRub: Math.trunc(product.price / 100),
        currency: product.currency,
        image: primaryImage?.url ?? product.category?.image ?? undefined,
        images: product.images.map((image) => image.url),
        isHit: product.isHit,
        categoryId: product.categoryId ?? undefined,
        categorySlug: product.category?.slug,
        categoryTitle: product.category?.title,
      },
      category,
    };
  }

  private async getCategoryContext(categoryId: string) {
    const category = await this.prisma.productCategory.findUnique({
      where: {
        id: categoryId,
      },
    });

    if (!category) {
      return undefined;
    }

    return {
      id: category.id,
      slug: category.slug,
      title: category.title,
      image: category.image ?? undefined,
    };
  }

  private renderPayload(value: unknown, context: SeoJsonObject): SeoPayload {
    const rendered = this.renderJsonValue(value, context);

    return this.normalizePayload(rendered);
  }

  private renderJsonValue(value: unknown, context: SeoJsonObject): unknown {
    if (typeof value === "string") {
      return Mustache.render(value, context, undefined, {
        escape: (input: unknown) => String(input),
      });
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.renderJsonValue(item, context));
    }

    if (this.isRecord(value)) {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
          key,
          this.renderJsonValue(item, context),
        ]),
      );
    }

    return value;
  }

  private normalizePath(value: string | undefined) {
    const path = value?.trim();

    if (!path) {
      throw new BadRequestException("path must be a non-empty string");
    }

    if (!path.startsWith("/")) {
      throw new BadRequestException("path must start with /");
    }

    if (path.length > 2048) {
      throw new BadRequestException("path must be at most 2048 characters");
    }

    return path;
  }

  private normalizePayload(value: unknown): SeoPayload {
    const payload = this.normalizeJson(value, "payload");

    if (!this.isRecord(payload)) {
      throw new BadRequestException("payload must be a JSON object");
    }

    return payload;
  }

  private normalizeJsonObject(value: unknown, field: string): SeoJsonObject {
    const json = this.normalizeJson(value, field);

    if (!this.isRecord(json)) {
      throw new BadRequestException(`${field} must be a JSON object`);
    }

    return json;
  }

  private normalizeJson(value: unknown, field: string) {
    try {
      const normalized = JSON.parse(JSON.stringify(value));

      if (normalized === undefined) {
        throw new Error("Undefined JSON value");
      }

      return normalized as unknown;
    } catch {
      throw new BadRequestException(`${field} must be valid JSON`);
    }
  }

  private asJsonObject(value: unknown): SeoJsonObject {
    return this.isRecord(value) ? value : {};
  }

  private isRecord(value: unknown): value is SeoJsonObject {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  private getStringValue(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }

  private parseOptionalString(value: string | null | undefined) {
    const trimmed = value?.trim();

    return trimmed ? trimmed : undefined;
  }

  private toPrismaJson(value: SeoJsonObject): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
  }

  private mapEntryStatus(status: PrismaSeoEntryStatus): SeoEntryStatus {
    switch (status) {
      case PrismaSeoEntryStatus.DRAFT:
        return "draft";
      case PrismaSeoEntryStatus.PUBLISHED:
        return "published";
      case PrismaSeoEntryStatus.ARCHIVED:
        return "archived";
    }
  }

  private mapSnapshotKind(kind: PrismaSeoSnapshotKind): SeoSnapshotKind {
    switch (kind) {
      case PrismaSeoSnapshotKind.DRAFT:
        return "draft";
      case PrismaSeoSnapshotKind.PUBLISHED:
        return "published";
      case PrismaSeoSnapshotKind.ARCHIVED:
        return "archived";
    }
  }

  private mapEntry(entry: StoredSeoEntry) {
    const draftSnapshot = entry.draftSnapshotId
      ? this.getSnapshot(entry, entry.draftSnapshotId)
      : undefined;
    const publishedSnapshot = entry.publishedSnapshotId
      ? this.getSnapshot(entry, entry.publishedSnapshotId)
      : undefined;

    return {
      id: entry.id,
      path: entry.path,
      source: this.asJsonObject(entry.source),
      status: this.mapEntryStatus(entry.status),
      draftSnapshotId: entry.draftSnapshotId ?? undefined,
      publishedSnapshotId: entry.publishedSnapshotId ?? undefined,
      createdById: entry.createdById ?? undefined,
      updatedById: entry.updatedById ?? undefined,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
      draftSnapshot: draftSnapshot
        ? this.mapSnapshot(draftSnapshot)
        : undefined,
      publishedSnapshot: publishedSnapshot
        ? this.mapSnapshot(publishedSnapshot)
        : undefined,
    };
  }

  private mapSnapshot(snapshot: StoredSeoSnapshot) {
    return {
      id: snapshot.id,
      entryId: snapshot.entryId,
      version: snapshot.version,
      kind: this.mapSnapshotKind(snapshot.kind),
      payload: this.normalizePayload(snapshot.payload),
      comment: snapshot.comment ?? undefined,
      createdById: snapshot.createdById ?? undefined,
      publishedAt: snapshot.publishedAt?.toISOString(),
      createdAt: snapshot.createdAt.toISOString(),
    };
  }

  private getSiteUrl() {
    return (process.env.SITE_URL ?? "https://www.art-mate.ru").replace(/\/+$/, "");
  }

  private handlePrismaMutationError(
    error: unknown,
    conflictMessage: string,
  ): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictException(conflictMessage);
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new NotFoundException("SEO entry not found");
    }

    throw error;
  }
}
