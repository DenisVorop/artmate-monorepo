import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import {
  ColoringCollectionStatus as PrismaColoringCollectionStatus,
  ColoringStatus as PrismaColoringStatus,
  Prisma,
  ProductTagGroup,
} from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";

import type { CreateColoringRequestDTO, UpdateColoringRequestDTO } from "./dto";
import type { ColoringStatus } from "./colorings.types";

type ColoringResponse = ReturnType<ColoringsService["mapColoring"]>;

const coloringInclude = {
  collection: {
    include: {
      product: true,
    },
  },
  themes: {
    include: {
      tag: true,
    },
  },
} satisfies Prisma.ColoringInclude;

type StoredColoring = Prisma.ColoringGetPayload<{
  include: typeof coloringInclude;
}>;

type LockedCollection = {
  expectedColoringCount: number;
  id: string;
  status: "archived" | "draft" | "published";
};

@Injectable()
export class ColoringsService {
  constructor(private readonly prisma: PrismaService) {}

  async getColorings(): Promise<ColoringResponse[]> {
    const colorings = await this.prisma.coloring.findMany({
      include: coloringInclude,
      orderBy: [{ collectionId: "asc" }, { position: "asc" }],
    });

    return colorings.map((coloring) => this.mapColoring(coloring));
  }

  async getColoring(coloringId: string): Promise<ColoringResponse> {
    const coloring = await this.prisma.coloring.findUnique({
      where: { id: coloringId },
      include: coloringInclude,
    });

    if (!coloring) {
      throw new NotFoundException("Coloring not found");
    }

    return this.mapColoring(coloring);
  }

  async createColoring(input: CreateColoringRequestDTO) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const collectionId = this.parseRequiredString(
          input.collectionId,
          "collectionId",
        );
        const themeTagIds = (input.themeTagIds ?? []).map((tagId) =>
          this.parseRequiredString(tagId, "themeTagIds"),
        );
        if (themeTagIds.length > 0) {
          const tags = await tx.productTag.findMany({
            where: {
              id: { in: themeTagIds },
            },
            select: {
              id: true,
              group: true,
            },
          });

          if (
            tags.length !== themeTagIds.length ||
            tags.some((tag) => tag.group !== ProductTagGroup.THEME)
          ) {
            throw new BadRequestException(
              "Theme tags must exist and belong to the theme group",
            );
          }
        }

        const collection = await this.lockCollection(tx, collectionId);

        this.assertCollectionAcceptsColorings(collection);

        const occupiedNumbers = await tx.coloring.findMany({
          where: { collectionId },
          select: { number: true },
          orderBy: { number: "asc" },
        });
        const number = this.getNextAvailableNumber(
          occupiedNumbers.map((coloring) => coloring.number),
          collection.expectedColoringCount,
        );

        const coloring = await tx.coloring.create({
          data: {
            collectionId,
            number,
            title: this.parseRequiredString(input.title, "title"),
            description: input.description?.trim() || null,
            position: input.position,
            status: PrismaColoringStatus.DRAFT,
            themes: {
              create: themeTagIds.map((tagId) => ({
                tagId,
              })),
            },
          },
          select: {
            id: true,
          },
        });

        const storedColoring = await tx.coloring.findUnique({
          where: { id: coloring.id },
          include: coloringInclude,
        });

        if (!storedColoring) {
          throw new Error("Created coloring could not be loaded");
        }

        return this.mapColoring(storedColoring);
      });
    } catch (error) {
      this.handleMutationError(error);
    }
  }

  async updateColoring(
    coloringId: string,
    input: UpdateColoringRequestDTO,
  ): Promise<ColoringResponse> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const expectedUpdatedAt = new Date(input.updatedAt);
        const existingColoring = await tx.coloring.findUnique({
          where: { id: coloringId },
          select: {
            collectionId: true,
            collection: {
              select: {
                expectedColoringCount: true,
                id: true,
                status: true,
              },
            },
            id: true,
            number: true,
            status: true,
            updatedAt: true,
          },
        });

        if (!existingColoring) {
          throw new NotFoundException("Coloring not found");
        }

        if (existingColoring.status !== PrismaColoringStatus.DRAFT) {
          throw new ConflictException(
            "Published or archived coloring metadata cannot be changed",
          );
        }

        if (
          !Number.isFinite(expectedUpdatedAt.getTime()) ||
          expectedUpdatedAt.getTime() !== existingColoring.updatedAt.getTime()
        ) {
          throw new ConflictException("Coloring changed concurrently");
        }

        const data: Prisma.ColoringUncheckedUpdateInput = {};
        const targetCollectionId =
          input.collectionId === undefined
            ? existingColoring.collectionId
            : this.parseRequiredString(input.collectionId, "collectionId");
        const targetCollection =
          input.collectionId !== undefined || input.number !== undefined
            ? await this.lockCollection(tx, targetCollectionId)
            : existingColoring.collection;
        const targetNumber = input.number ?? existingColoring.number;

        this.assertCollectionAcceptsColorings(targetCollection);

        if (targetNumber > targetCollection.expectedColoringCount) {
          throw new ConflictException(
            "Coloring number exceeds the collection expected count",
          );
        }

        if (input.collectionId !== undefined) {
          data.collectionId = targetCollectionId;
        }

        if (input.number !== undefined) {
          data.number = input.number;
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

        const themeTagIds = input.themeTagIds?.map((tagId) =>
          this.parseRequiredString(tagId, "themeTagIds"),
        );

        if (themeTagIds && themeTagIds.length > 0) {
          const tags = await tx.productTag.findMany({
            where: {
              id: { in: themeTagIds },
            },
            select: {
              id: true,
              group: true,
            },
          });

          if (
            tags.length !== themeTagIds.length ||
            tags.some((tag) => tag.group !== ProductTagGroup.THEME)
          ) {
            throw new BadRequestException(
              "Theme tags must exist and belong to the theme group",
            );
          }
        }

        const updated = await tx.coloring.updateMany({
          where: {
            id: coloringId,
            status: PrismaColoringStatus.DRAFT,
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
          throw new ConflictException("Coloring changed concurrently");
        }

        if (input.themeTagIds !== undefined) {
          await tx.coloringThemeAssignment.deleteMany({
            where: { coloringId },
          });

          if (themeTagIds && themeTagIds.length > 0) {
            await tx.coloringThemeAssignment.createMany({
              data: themeTagIds.map((tagId) => ({
                coloringId,
                tagId,
              })),
            });
          }
        }

        const coloring = await tx.coloring.findUnique({
          where: { id: coloringId },
          include: coloringInclude,
        });

        if (!coloring) {
          throw new NotFoundException("Coloring not found");
        }

        return this.mapColoring(coloring);
      });
    } catch (error) {
      this.handleMutationError(error);
    }
  }

  private mapColoring(coloring: StoredColoring) {
    return {
      id: coloring.id,
      collectionId: coloring.collectionId,
      number: coloring.number,
      title: coloring.title,
      description: coloring.description ?? undefined,
      position: coloring.position,
      status: this.mapColoringStatus(coloring.status),
      ...(coloring.publishedRevisionId
        ? { publishedRevisionId: coloring.publishedRevisionId }
        : {}),
      ...(coloring.publishedAt
        ? { publishedAt: coloring.publishedAt.toISOString() }
        : {}),
      collection: {
        id: coloring.collection.id,
        slug: coloring.collection.slug,
        title: coloring.collection.title,
        product: {
          id: coloring.collection.product.id,
          slug: coloring.collection.product.slug,
          title: coloring.collection.product.title,
        },
      },
      themes: coloring.themes
        .map(({ tag }) => ({
          id: tag.id,
          slug: tag.slug,
          title: tag.title,
        }))
        .sort((a, b) => a.title.localeCompare(b.title, "ru-RU")),
      createdAt: coloring.createdAt.toISOString(),
      updatedAt: coloring.updatedAt.toISOString(),
    };
  }

  private mapColoringStatus(status: PrismaColoringStatus): ColoringStatus {
    switch (status) {
      case PrismaColoringStatus.DRAFT:
        return "draft";
      case PrismaColoringStatus.PUBLISHED:
        return "published";
      case PrismaColoringStatus.ARCHIVED:
        return "archived";
      default: {
        const exhaustiveStatus: never = status;

        return exhaustiveStatus;
      }
    }
  }

  private parseRequiredString(value: string, field: string) {
    const trimmed = value.trim();

    if (!trimmed) {
      throw new BadRequestException(`${field} must be a non-empty string`);
    }

    return trimmed;
  }

  private async lockCollection(
    tx: Prisma.TransactionClient,
    collectionId: string,
  ): Promise<LockedCollection> {
    const collections = await tx.$queryRaw<LockedCollection[]>(
      Prisma.sql`SELECT
                   "id",
                   "status"::text AS "status",
                   "expected_coloring_count" AS "expectedColoringCount"
                 FROM "coloring_collections"
                 WHERE "id" = ${collectionId}
                 FOR UPDATE`,
    );
    const collection = collections[0];

    if (!collection) {
      throw new NotFoundException("Coloring collection not found");
    }

    return collection;
  }

  private assertCollectionAcceptsColorings(collection: {
    status: LockedCollection["status"] | PrismaColoringCollectionStatus;
  }) {
    if (
      collection.status === "archived" ||
      collection.status === PrismaColoringCollectionStatus.ARCHIVED
    ) {
      throw new ConflictException(
        "Archived coloring collection cannot receive colorings",
      );
    }
  }

  private getNextAvailableNumber(
    occupiedNumbers: readonly number[],
    expectedColoringCount: number,
  ) {
    const occupied = new Set(occupiedNumbers);

    for (let number = 1; number <= expectedColoringCount; number += 1) {
      if (!occupied.has(number)) {
        return number;
      }
    }

    throw new ConflictException("Coloring collection has no available numbers");
  }

  private handleMutationError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const target = Array.isArray(error.meta?.target)
        ? error.meta.target.map(String)
        : [String(error.meta?.target ?? "")];

      if (target.some((field) => field.includes("number"))) {
        throw new ConflictException(
          "Coloring number already exists for this collection",
        );
      }

      throw new ConflictException(
        "Coloring position already exists for this collection",
      );
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      throw new ConflictException(
        "Coloring collection or theme tag no longer exists",
      );
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new NotFoundException("Coloring not found");
    }

    throw error;
  }
}
