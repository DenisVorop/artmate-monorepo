import { randomBytes } from "node:crypto";

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import {
  ColoringCollectionStatus,
  ColoringRevisionReviewDecision,
  ColoringStatus,
  Prisma,
  ProductStatus,
} from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";

import type {
  CreateColoringRevisionRequestDTO,
  ReviewColoringRevisionRequestDTO,
} from "./dto";
import {
  currentColoringDerivativeProfile,
  type ColoringDerivativeProfile,
} from "./coloring-derivative-profile";
import { formatColoringNumber } from "./coloring-number";
import {
  coloringPaletteMaxColors,
  getColoringPaletteSymbol,
} from "./coloring-palette";
import {
  ColoringMediaService,
  type UploadedColoringFile,
} from "./coloring-media.service";
import {
  ColoringStorageService,
  type StoredColoringFile,
} from "./coloring-storage.service";

const markerPaletteLabel = "Artmate 168";
const markerPaletteVersion = "2026-08";
const markerColorIdPattern = /^marker-color-\d{3}$/;

const revisionInclude = {
  review: true,
  paletteColors: {
    orderBy: { symbolPosition: "asc" },
  },
  coloring: {
    include: {
      collection: {
        include: {
          product: {
            select: {
              status: true,
            },
          },
        },
      },
      themes: {
        select: {
          coloringId: true,
          tagId: true,
        },
      },
    },
  },
} satisfies Prisma.ColoringRevisionInclude;

type StoredRevision = Prisma.ColoringRevisionGetPayload<{
  include: typeof revisionInclude;
}>;

export type UploadedColoringRevisionFiles = {
  outline?: UploadedColoringFile[];
  colored?: UploadedColoringFile[];
};

@Injectable()
export class ColoringRevisionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: ColoringMediaService,
    private readonly storageService: ColoringStorageService,
  ) {}

  async createRevision(
    coloringId: string,
    input: CreateColoringRevisionRequestDTO,
    files: UploadedColoringRevisionFiles | undefined,
    createdById: string,
  ) {
    const outline = this.getSingleFile(files?.outline, "outline");
    const colored = this.getSingleFile(files?.colored, "colored");
    const coloring = await this.prisma.coloring.findUnique({
      where: { id: coloringId },
      select: {
        id: true,
        status: true,
        collection: { select: { status: true } },
      },
    });

    if (!coloring) {
      throw new NotFoundException("Coloring not found");
    }

    this.assertRevisionWorkflowActive(coloring);
    const paletteColors = await this.getPaletteColors(input.markerColorIds);

    const pair = await this.mediaService.processPair(outline, colored);
    const revisionId = randomBytes(16).toString("hex");
    const outlineStorageKey = this.storageKey(
      coloringId,
      revisionId,
      "outline",
      pair.outline.checksum,
    );
    const coloredStorageKey = this.storageKey(
      coloringId,
      revisionId,
      "colored",
      pair.colored.checksum,
    );
    const cardStorageKey = this.storageKey(
      coloringId,
      revisionId,
      "card",
      pair.card.checksum,
    );
    const storedFiles = await this.storageService.writePrivatePair([
      {
        key: outlineStorageKey,
        buffer: pair.outline.buffer,
        checksum: pair.outline.checksum,
      },
      {
        key: coloredStorageKey,
        buffer: pair.colored.buffer,
        checksum: pair.colored.checksum,
      },
      {
        key: cardStorageKey,
        buffer: pair.card.buffer,
        checksum: pair.card.checksum,
      },
    ]);

    try {
      const revision = await this.prisma.$transaction(async (tx) => {
        const sequence = await tx.coloring.update({
          where: { id: coloringId },
          data: { revisionSequence: { increment: 1 } },
          select: { revisionSequence: true },
        });
        await tx.coloringRevision.create({
          data: {
            id: revisionId,
            coloringId,
            version: sequence.revisionSequence,
            paletteLabel: markerPaletteLabel,
            paletteVersion: markerPaletteVersion,
            usedColorCount: paletteColors.length,
            width: pair.width,
            height: pair.height,
            derivativeProfile: currentColoringDerivativeProfile,
            colorSpace: "srgb",
            outlineSourceMime: pair.outline.sourceMime,
            outlineSourceChecksum: pair.outline.sourceChecksum,
            outlineStorageKey,
            outlineByteSize: pair.outline.byteSize,
            outlineChecksum: pair.outline.checksum,
            outlineAlt: input.outlineAlt,
            coloredSourceMime: pair.colored.sourceMime,
            coloredSourceChecksum: pair.colored.sourceChecksum,
            coloredStorageKey,
            coloredByteSize: pair.colored.byteSize,
            coloredChecksum: pair.colored.checksum,
            coloredAlt: input.coloredAlt,
            cardStorageKey,
            cardByteSize: pair.card.byteSize,
            cardChecksum: pair.card.checksum,
            cardWidth: pair.card.width,
            cardHeight: pair.card.height,
            createdById,
            paletteColors: {
              create: paletteColors.map((color, index) => ({
                markerColorId: color.id,
                symbolPosition: index + 1,
                colorNumber: color.colorNumber,
                pantone: color.pantone,
                hex: color.hex,
                markerNumber: color.markerNumber,
              })),
            },
          },
        });

        const created = await tx.coloringRevision.findUnique({
          where: { id: revisionId },
          include: revisionInclude,
        });

        if (!created) {
          throw new Error("Created coloring revision could not be loaded");
        }

        return created;
      });

      return this.mapRevision(revision);
    } catch (error) {
      let committed: StoredRevision | null;

      try {
        committed = await this.prisma.coloringRevision.findUnique({
          where: {
            coloringId_id: {
              coloringId,
              id: revisionId,
            },
          },
          include: revisionInclude,
        });
      } catch {
        this.handleMutationError(error);
      }

      if (
        committed &&
        committed.outlineStorageKey === outlineStorageKey &&
        committed.coloredStorageKey === coloredStorageKey &&
        committed.cardStorageKey === cardStorageKey &&
        committed.outlineSourceChecksum === pair.outline.sourceChecksum &&
        committed.coloredSourceChecksum === pair.colored.sourceChecksum &&
        committed.outlineChecksum === pair.outline.checksum &&
        committed.coloredChecksum === pair.colored.checksum &&
        committed.cardChecksum === pair.card.checksum
      ) {
        return this.mapRevision(committed);
      }

      await this.storageService.cleanupPrivate(
        storedFiles.filter(({ created }) => created).map(({ key }) => key),
      );
      this.handleMutationError(error);
    }
  }

  async getRevisions(coloringId: string) {
    const coloring = await this.prisma.coloring.findUnique({
      where: { id: coloringId },
      select: { id: true },
    });

    if (!coloring) {
      throw new NotFoundException("Coloring not found");
    }

    const revisions = await this.prisma.coloringRevision.findMany({
      where: { coloringId },
      include: revisionInclude,
      orderBy: { version: "desc" },
    });

    return revisions.map((revision) => this.mapRevision(revision));
  }

  async getRevisionAsset(
    coloringId: string,
    revisionId: string,
    kind: "outline" | "colored",
  ) {
    const revision = await this.findRevision(coloringId, revisionId);
    const asset =
      kind === "outline"
        ? {
            key: revision.outlineStorageKey,
            checksum: revision.outlineChecksum,
          }
        : {
            key: revision.coloredStorageKey,
            checksum: revision.coloredChecksum,
          };

    return this.storageService.readProtected(asset.key, {
      checksum: asset.checksum,
      width: revision.width,
      height: revision.height,
    });
  }

  async reviewRevision(
    coloringId: string,
    revisionId: string,
    input: ReviewColoringRevisionRequestDTO,
    reviewedById: string,
  ) {
    const revision = await this.findRevision(coloringId, revisionId);

    this.assertRevisionWorkflowActive(revision.coloring);

    if (revision.review) {
      throw new ConflictException(
        "Coloring revision has already been reviewed",
      );
    }

    const comment = input.comment?.trim() || null;

    if (input.decision === "rejected" && !comment) {
      throw new BadRequestException("Rejected revision requires a comment");
    }

    try {
      await this.prisma.coloringRevisionReview.create({
        data: {
          revisionId,
          decision:
            input.decision === "approved"
              ? ColoringRevisionReviewDecision.APPROVED
              : ColoringRevisionReviewDecision.REJECTED,
          comment,
          reviewedById,
        },
      });
    } catch (error) {
      this.handleMutationError(error, true);
    }

    return this.mapRevision(await this.findRevision(coloringId, revisionId));
  }

  async publishRevision(
    coloringId: string,
    revisionId: string,
    publishedById: string,
  ) {
    const preflight = await this.findRevision(coloringId, revisionId);

    if (preflight.coloring.publishedRevisionId !== revisionId) {
      this.assertPublishReady(preflight);
    }

    const expectedUpdatedAt = preflight.coloring.updatedAt;
    let publicFiles: StoredColoringFile[] = [];

    try {
      const published = await this.prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw(
            Prisma.sql`SELECT c."id"
                       FROM "colorings" c
                       JOIN "coloring_collections" cc ON cc."id" = c."collection_id"
                       JOIN "products" p ON p."id" = cc."product_id"
                       WHERE c."id" = ${coloringId}
                       FOR UPDATE OF c, cc, p`,
          );
          const current = await tx.coloringRevision.findUnique({
            where: {
              coloringId_id: {
                coloringId,
                id: revisionId,
              },
            },
            include: revisionInclude,
          });

          if (!current) {
            throw new NotFoundException("Coloring revision not found");
          }

          if (current.coloring.publishedRevisionId === revisionId) {
            publicFiles = await this.materializeRevision(current);

            if (current.firstPublishedAt) {
              return current;
            }

            const firstPublishedAt = current.coloring.publishedAt;

            if (!firstPublishedAt) {
              throw new ConflictException("Coloring publication is incomplete");
            }

            await tx.coloringRevision.updateMany({
              where: {
                coloringId,
                id: revisionId,
                firstPublishedAt: null,
              },
              data: { firstPublishedAt },
            });

            const repaired = await tx.coloringRevision.findUnique({
              where: { id: revisionId },
              include: revisionInclude,
            });

            if (!repaired?.firstPublishedAt) {
              throw new ConflictException("Coloring publication is incomplete");
            }

            return repaired;
          }

          if (
            current.coloring.updatedAt.getTime() !== expectedUpdatedAt.getTime()
          ) {
            throw new ConflictException("Coloring changed during publication");
          }

          this.assertPublishReady(current);
          publicFiles = await this.materializeRevision(current);
          const publishedAt = new Date();
          await tx.coloringRevision.updateMany({
            where: {
              coloringId,
              id: revisionId,
              firstPublishedAt: null,
            },
            data: { firstPublishedAt: publishedAt },
          });
          const switched = await tx.coloring.updateMany({
            where: {
              id: coloringId,
              updatedAt: expectedUpdatedAt,
              status: { not: ColoringStatus.ARCHIVED },
            },
            data: {
              status: ColoringStatus.PUBLISHED,
              publishedRevisionId: revisionId,
              publishedAt,
              publishedById,
              updatedAt: new Date(
                Math.max(
                  publishedAt.getTime(),
                  current.coloring.updatedAt.getTime() + 1,
                ),
              ),
            },
          });

          if (switched.count !== 1) {
            throw new ConflictException("Coloring changed during publication");
          }

          const result = await tx.coloringRevision.findUnique({
            where: { id: revisionId },
            include: revisionInclude,
          });

          if (!result) {
            throw new NotFoundException("Coloring revision not found");
          }

          return result;
        },
        { timeout: 60_000 },
      );

      await this.storageService.cleanupPrivate([
        preflight.outlineStorageKey,
        preflight.coloredStorageKey,
        ...(preflight.cardStorageKey ? [preflight.cardStorageKey] : []),
      ]);

      return this.mapRevision(published);
    } catch (error) {
      if (publicFiles.length === 0) {
        throw error;
      }

      let committed: StoredRevision | null;

      try {
        committed = await this.prisma.$transaction(
          async (tx) => {
            await tx.$queryRaw(
              Prisma.sql`SELECT "id"
                         FROM "colorings"
                         WHERE "id" = ${coloringId}
                         FOR UPDATE`,
            );
            const current = await tx.coloringRevision.findUnique({
              where: {
                coloringId_id: {
                  coloringId,
                  id: revisionId,
                },
              },
              include: revisionInclude,
            });

            if (current?.firstPublishedAt) {
              return current;
            }

            await this.storageService.cleanupPublic(publicFiles);
            return null;
          },
          { timeout: 60_000 },
        );
      } catch {
        // Preserve public files when commit outcome cannot be established.
        throw error;
      }

      if (committed?.coloring.publishedRevisionId === revisionId) {
        await this.storageService.cleanupPrivate([
          committed.outlineStorageKey,
          committed.coloredStorageKey,
          ...(committed.cardStorageKey ? [committed.cardStorageKey] : []),
        ]);
        return this.mapRevision(committed);
      }

      throw error;
    }
  }

  private materializeRevision(revision: StoredRevision) {
    const entries = [
      {
        key: revision.outlineStorageKey,
        checksum: revision.outlineChecksum,
        width: revision.width,
        height: revision.height,
      },
      {
        key: revision.coloredStorageKey,
        checksum: revision.coloredChecksum,
        width: revision.width,
        height: revision.height,
      },
    ];

    if (
      revision.cardStorageKey &&
      revision.cardChecksum &&
      revision.cardWidth &&
      revision.cardHeight
    ) {
      entries.push({
        key: revision.cardStorageKey,
        checksum: revision.cardChecksum,
        width: revision.cardWidth,
        height: revision.cardHeight,
      });
    }

    return this.storageService.materializePublicPair(entries);
  }

  private async findRevision(coloringId: string, revisionId: string) {
    const revision = await this.prisma.coloringRevision.findUnique({
      where: {
        coloringId_id: {
          coloringId,
          id: revisionId,
        },
      },
      include: revisionInclude,
    });

    if (!revision) {
      throw new NotFoundException("Coloring revision not found");
    }

    return revision;
  }

  private assertPublishReady(revision: StoredRevision) {
    if (revision.review?.decision !== ColoringRevisionReviewDecision.APPROVED) {
      throw new BadRequestException("Coloring revision is not approved");
    }

    if (revision.coloring.status === ColoringStatus.ARCHIVED) {
      throw new BadRequestException("Archived coloring cannot be published");
    }

    if (!revision.coloring.description?.trim()) {
      throw new BadRequestException("Coloring description is required");
    }

    if (revision.coloring.themes.length === 0) {
      throw new BadRequestException("Coloring theme is required");
    }

    if (
      revision.coloring.collection.status === ColoringCollectionStatus.ARCHIVED
    ) {
      throw new BadRequestException(
        "Archived coloring collection cannot be published",
      );
    }

    if (
      revision.coloring.collection.product.status !== ProductStatus.PUBLISHED
    ) {
      throw new BadRequestException("Parent product must be published");
    }
  }

  private assertRevisionWorkflowActive(coloring: {
    status: ColoringStatus;
    collection: { status: ColoringCollectionStatus };
  }) {
    if (coloring.status === ColoringStatus.ARCHIVED) {
      throw new BadRequestException(
        "Archived coloring cannot receive revisions",
      );
    }

    if (coloring.collection.status === ColoringCollectionStatus.ARCHIVED) {
      throw new BadRequestException(
        "Archived coloring collection cannot receive revisions",
      );
    }
  }

  private mapRevision(revision: StoredRevision) {
    const isPublished = revision.coloring.publishedRevisionId === revision.id;
    const assetUrl = (kind: "outline" | "colored") =>
      `${this.getApiPublicUrl()}/admin/colorings/${revision.coloringId}/revisions/${revision.id}/assets/${kind}/content`;
    const publicUrl = (kind: "outline" | "colored") =>
      isPublished
        ? `${this.getApiPublicUrl()}/colorings/${encodeURIComponent(revision.coloring.collection.slug)}/${formatColoringNumber(revision.coloring.number)}/assets/${encodeURIComponent(revision.id)}/${kind}/content`
        : undefined;

    return {
      id: revision.id,
      coloringId: revision.coloringId,
      version: revision.version,
      status: isPublished
        ? ("published" as const)
        : revision.review?.decision === ColoringRevisionReviewDecision.APPROVED
          ? ("approved" as const)
          : revision.review?.decision ===
              ColoringRevisionReviewDecision.REJECTED
            ? ("rejected" as const)
            : ("review_required" as const),
      paletteLabel: revision.paletteLabel,
      paletteVersion: revision.paletteVersion,
      usedColorCount: revision.usedColorCount,
      paletteColors: (revision.paletteColors ?? []).map((color) => ({
        markerColorId: color.markerColorId,
        symbolPosition: color.symbolPosition,
        symbol: getColoringPaletteSymbol(color.symbolPosition),
        colorNumber: color.colorNumber,
        pantone: color.pantone,
        hex: color.hex,
        markerNumber: color.markerNumber,
      })),
      width: revision.width,
      height: revision.height,
      derivativeProfile:
        revision.derivativeProfile as ColoringDerivativeProfile,
      colorSpace: "srgb" as const,
      outline: {
        sourceMime: revision.outlineSourceMime as "image/png" | "image/webp",
        sourceChecksum: revision.outlineSourceChecksum,
        mimeType: "image/webp" as const,
        byteSize: revision.outlineByteSize,
        checksum: revision.outlineChecksum,
        alt: revision.outlineAlt,
        previewUrl: assetUrl("outline"),
        publicUrl: publicUrl("outline"),
      },
      colored: {
        sourceMime: revision.coloredSourceMime as "image/png" | "image/webp",
        sourceChecksum: revision.coloredSourceChecksum,
        mimeType: "image/webp" as const,
        byteSize: revision.coloredByteSize,
        checksum: revision.coloredChecksum,
        alt: revision.coloredAlt,
        previewUrl: assetUrl("colored"),
        publicUrl: publicUrl("colored"),
      },
      review: revision.review
        ? {
            decision:
              revision.review.decision ===
              ColoringRevisionReviewDecision.APPROVED
                ? ("approved" as const)
                : ("rejected" as const),
            comment: revision.review.comment ?? undefined,
            reviewedById: revision.review.reviewedById ?? undefined,
            reviewedAt: revision.review.reviewedAt.toISOString(),
          }
        : undefined,
      createdById: revision.createdById ?? undefined,
      createdAt: revision.createdAt.toISOString(),
    };
  }

  private getSingleFile(
    files: UploadedColoringFile[] | undefined,
    kind: "outline" | "colored",
  ) {
    if (files?.length !== 1 || !files[0]) {
      throw new BadRequestException(`Exactly one ${kind} file is required`);
    }

    return files[0];
  }

  private async getPaletteColors(markerColorIds: string[]) {
    if (
      !Array.isArray(markerColorIds) ||
      markerColorIds.length < 1 ||
      markerColorIds.length > coloringPaletteMaxColors ||
      new Set(markerColorIds).size !== markerColorIds.length ||
      markerColorIds.some((id) => !markerColorIdPattern.test(id))
    ) {
      throw new BadRequestException(
        `Marker palette must contain 1 to ${coloringPaletteMaxColors} unique marker color IDs`,
      );
    }

    const colors = await this.prisma.markerColor.findMany({
      where: { id: { in: markerColorIds } },
      select: {
        id: true,
        colorNumber: true,
        pantone: true,
        hex: true,
        markerNumber: true,
      },
    });
    const colorsById = new Map(colors.map((color) => [color.id, color]));

    if (colorsById.size !== markerColorIds.length) {
      throw new BadRequestException("Marker palette contains unknown colors");
    }

    return markerColorIds.map((id) => colorsById.get(id)!);
  }

  private storageKey(
    coloringId: string,
    revisionId: string,
    kind: "outline" | "colored" | "card",
    checksum: string,
  ) {
    return `${coloringId}/${revisionId}/${kind}-${checksum}.webp`;
  }

  private getApiPublicUrl() {
    return (
      process.env.API_PUBLIC_URL ??
      process.env.API_BASE_URL ??
      `http://localhost:${process.env.PORT ?? "3002"}`
    ).replace(/\/+$/, "");
  }

  private handleMutationError(error: unknown, review = false): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        throw new ConflictException(
          review
            ? "Coloring revision has already been reviewed"
            : "Coloring revision conflicts with existing data",
        );
      }

      if (error.code === "P2003") {
        throw new ConflictException("Coloring revision relation changed");
      }

      if (error.code === "P2025") {
        throw new NotFoundException("Coloring not found");
      }
    }

    throw error;
  }
}
