import { Injectable, NotFoundException } from "@nestjs/common";

import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";

import { formatColoringNumber } from "./coloring-number";
import { getColoringPaletteSymbol } from "./coloring-palette";
import { ColoringStorageService } from "./coloring-storage.service";
import { publicColoringWhere } from "./public-coloring-eligibility";

const publicColoringSelect = {
  id: true,
  number: true,
  title: true,
  description: true,
  publishedRevisionId: true,
  publishedAt: true,
  collection: {
    select: {
      id: true,
      slug: true,
      title: true,
      product: {
        select: {
          id: true,
          slug: true,
          title: true,
          category: {
            select: { id: true, slug: true, title: true },
          },
        },
      },
    },
  },
  themes: {
    select: {
      tag: { select: { id: true, slug: true, title: true } },
    },
  },
  publishedRevision: {
    select: {
      id: true,
      firstPublishedAt: true,
      paletteLabel: true,
      paletteVersion: true,
      usedColorCount: true,
      paletteColors: {
        select: {
          symbolPosition: true,
          colorNumber: true,
          pantone: true,
          hex: true,
          markerNumber: true,
        },
        orderBy: { symbolPosition: "asc" },
      },
      width: true,
      height: true,
      outlineAlt: true,
      coloredAlt: true,
    },
  },
} satisfies Prisma.ColoringSelect;

const publicManifestSelect = {
  number: true,
  description: true,
  updatedAt: true,
  collection: {
    select: {
      slug: true,
      updatedAt: true,
      product: {
        select: {
          updatedAt: true,
          category: { select: { updatedAt: true } },
        },
      },
    },
  },
  themes: {
    select: { tag: { select: { updatedAt: true } } },
  },
} satisfies Prisma.ColoringSelect;

type PublicColoringRecord = Prisma.ColoringGetPayload<{
  select: typeof publicColoringSelect;
}>;

export type PublicColoringAssetDescriptor = {
  key: string;
  checksum: string;
  byteSize: number;
  width: number;
  height: number;
};

@Injectable()
export class PublicColoringsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: ColoringStorageService,
  ) {}

  async getManifest() {
    const colorings = await this.prisma.coloring.findMany({
      where: publicColoringWhere,
      select: publicManifestSelect,
      orderBy: [{ collection: { slug: "asc" } }, { number: "asc" }],
    });

    return colorings
      .filter(({ description }) => Boolean(description?.trim()))
      .map((coloring) => ({
        collectionSlug: coloring.collection.slug,
        number: coloring.number,
        lastModified: new Date(
          Math.max(
            coloring.updatedAt.getTime(),
            coloring.collection.updatedAt.getTime(),
            coloring.collection.product.updatedAt.getTime(),
            coloring.collection.product.category?.updatedAt.getTime() ?? 0,
            ...coloring.themes.map(({ tag }) => tag.updatedAt.getTime()),
          ),
        ).toISOString(),
      }));
  }

  getColoring(collectionSlug: string, number: number) {
    return this.getColoringByIdentity(collectionSlug, number);
  }

  private async getColoringByIdentity(collectionSlug: string, number: number) {
    const coloring = await this.prisma.coloring.findFirst({
      where: {
        AND: [
          publicColoringWhere,
          this.getColoringIdentityWhere(collectionSlug, number),
        ],
      },
      select: publicColoringSelect,
    });

    if (!this.isPublicRecord(coloring)) {
      throw this.notFound();
    }

    const revision = coloring.publishedRevision;
    const formattedNumber = formatColoringNumber(coloring.number);
    const assetUrl = (kind: "outline" | "colored") =>
      `${this.getApiPublicUrl()}/colorings/${encodeURIComponent(coloring.collection.slug)}/${formattedNumber}/assets/${encodeURIComponent(revision.id)}/${kind}/content`;

    return {
      id: coloring.id,
      number: coloring.number,
      title: coloring.title,
      description: coloring.description,
      publishedRevisionId: coloring.publishedRevisionId,
      publishedAt: coloring.publishedAt.toISOString(),
      firstPublishedAt: revision.firstPublishedAt.toISOString(),
      themes: coloring.themes
        .map(({ tag }) => ({
          id: tag.id,
          slug: tag.slug,
          title: tag.title,
        }))
        .sort(
          (left, right) =>
            left.title.localeCompare(right.title, "ru-RU") ||
            left.slug.localeCompare(right.slug) ||
            left.id.localeCompare(right.id),
        ),
      collection: {
        id: coloring.collection.id,
        slug: coloring.collection.slug,
        title: coloring.collection.title,
        product: {
          id: coloring.collection.product.id,
          slug: coloring.collection.product.slug,
          title: coloring.collection.product.title,
          ...(coloring.collection.product.category
            ? {
                category: {
                  id: coloring.collection.product.category.id,
                  slug: coloring.collection.product.category.slug,
                  title: coloring.collection.product.category.title,
                },
              }
            : {}),
        },
      },
      palette: {
        label: revision.paletteLabel,
        version: revision.paletteVersion,
        usedColorCount: revision.usedColorCount,
        colors: revision.paletteColors.map((color) => ({
          symbolPosition: color.symbolPosition,
          symbol: getColoringPaletteSymbol(color.symbolPosition),
          colorNumber: color.colorNumber,
          pantone: color.pantone,
          hex: color.hex,
          markerNumber: color.markerNumber,
        })),
      },
      width: revision.width,
      height: revision.height,
      outline: { url: assetUrl("outline"), alt: revision.outlineAlt },
      colored: { url: assetUrl("colored"), alt: revision.coloredAlt },
    };
  }

  async getAssetDescriptor(
    collectionSlug: string,
    number: number,
    revisionId: string,
    kind: "outline" | "colored" | "card",
  ): Promise<PublicColoringAssetDescriptor> {
    return this.getAssetDescriptorByIdentity(
      { collectionSlug, number },
      revisionId,
      kind,
    );
  }

  private async getAssetDescriptorByIdentity(
    identity: { collectionSlug: string; number: number },
    revisionId: string,
    kind: "outline" | "colored" | "card",
  ): Promise<PublicColoringAssetDescriptor> {
    const coloringWhere = this.getColoringIdentityWhere(
      identity.collectionSlug,
      identity.number,
    );

    if (kind === "outline") {
      const revision = await this.prisma.coloringRevision.findFirst({
        where: {
          id: revisionId,
          firstPublishedAt: { not: null },
          coloring: { is: coloringWhere },
        },
        select: {
          width: true,
          height: true,
          outlineStorageKey: true,
          outlineByteSize: true,
          outlineChecksum: true,
        },
      });

      if (!revision) {
        throw this.notFound();
      }

      return {
        key: revision.outlineStorageKey,
        checksum: revision.outlineChecksum,
        byteSize: revision.outlineByteSize,
        width: revision.width,
        height: revision.height,
      };
    }

    const revision = await this.prisma.coloringRevision.findFirst({
      where: {
        id: revisionId,
        firstPublishedAt: { not: null },
        coloring: { is: coloringWhere },
      },
      select: {
        width: true,
        height: true,
        coloredStorageKey: true,
        coloredByteSize: true,
        coloredChecksum: true,
        cardStorageKey: true,
        cardByteSize: true,
        cardChecksum: true,
        cardWidth: true,
        cardHeight: true,
      },
    });

    if (!revision) {
      throw this.notFound();
    }

    if (
      kind === "card" &&
      revision.cardStorageKey &&
      revision.cardByteSize &&
      revision.cardChecksum &&
      revision.cardWidth &&
      revision.cardHeight
    ) {
      return {
        key: revision.cardStorageKey,
        checksum: revision.cardChecksum,
        byteSize: revision.cardByteSize,
        width: revision.cardWidth,
        height: revision.cardHeight,
      };
    }

    return {
      key: revision.coloredStorageKey,
      checksum: revision.coloredChecksum,
      byteSize: revision.coloredByteSize,
      width: revision.width,
      height: revision.height,
    };
  }

  readAsset(asset: PublicColoringAssetDescriptor) {
    return this.storageService.readPublic(asset.key, {
      checksum: asset.checksum,
      width: asset.width,
      height: asset.height,
    });
  }

  private getColoringIdentityWhere(
    collectionSlug: string,
    number: number,
  ): Prisma.ColoringWhereInput {
    return {
      number,
      collection: { is: { slug: collectionSlug } },
    };
  }

  private isPublicRecord(
    coloring: PublicColoringRecord | null,
  ): coloring is PublicColoringRecord & {
    description: string;
    publishedRevisionId: string;
    publishedAt: Date;
    publishedRevision: NonNullable<
      PublicColoringRecord["publishedRevision"]
    > & {
      firstPublishedAt: Date;
    };
  } {
    return Boolean(
      coloring?.description?.trim() &&
      coloring.publishedRevisionId &&
      coloring.publishedAt &&
      coloring.publishedRevision?.firstPublishedAt,
    );
  }

  private notFound() {
    return new NotFoundException("Coloring not found");
  }

  private getApiPublicUrl() {
    return (
      process.env.API_PUBLIC_URL ??
      process.env.API_BASE_URL ??
      `http://localhost:${process.env.PORT ?? "3002"}`
    ).replace(/\/+$/, "");
  }
}
