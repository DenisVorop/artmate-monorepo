import { Injectable, NotFoundException } from "@nestjs/common";

import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";

import {
  publicColoringCollectionWhere,
  publicColoringReadinessWhere,
} from "./public-coloring-eligibility";
import { formatColoringNumber } from "./coloring-number";

const publicCollectionSelect = {
  id: true,
  slug: true,
  title: true,
  description: true,
  expectedColoringCount: true,
  coverUrl: true,
  coverAlt: true,
  coverWidth: true,
  coverHeight: true,
  publishedAt: true,
  updatedAt: true,
  product: {
    select: {
      id: true,
      slug: true,
      title: true,
      updatedAt: true,
      category: {
        select: {
          id: true,
          slug: true,
          title: true,
          updatedAt: true,
        },
      },
    },
  },
  colorings: {
    where: publicColoringReadinessWhere,
    orderBy: [{ position: "asc" }, { id: "asc" }],
    select: {
      id: true,
      number: true,
      title: true,
      description: true,
      position: true,
      publishedRevisionId: true,
      publishedAt: true,
      updatedAt: true,
      themes: {
        select: { tag: { select: { updatedAt: true } } },
      },
      publishedRevision: {
        select: {
          id: true,
          firstPublishedAt: true,
          coloredStorageKey: true,
          coloredByteSize: true,
          coloredChecksum: true,
          coloredAlt: true,
          width: true,
          height: true,
          cardStorageKey: true,
          cardByteSize: true,
          cardChecksum: true,
          cardWidth: true,
          cardHeight: true,
        },
      },
    },
  },
} satisfies Prisma.ColoringCollectionSelect;

type PublicCollectionRecord = Prisma.ColoringCollectionGetPayload<{
  select: typeof publicCollectionSelect;
}>;

type PublicCollectionColoring = PublicCollectionRecord["colorings"][number];

@Injectable()
export class PublicColoringCollectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCollections() {
    const collections = await this.prisma.coloringCollection.findMany({
      where: publicColoringCollectionWhere,
      select: publicCollectionSelect,
      orderBy: [{ position: "asc" }, { id: "asc" }],
    });

    return collections.flatMap((collection) => {
      const mapped = this.mapCollection(collection);

      return mapped ? [mapped.summary] : [];
    });
  }

  async getCollection(slug: string) {
    const collection = await this.prisma.coloringCollection.findFirst({
      where: { slug, ...publicColoringCollectionWhere },
      select: publicCollectionSelect,
    });
    const mapped = collection ? this.mapCollection(collection) : null;

    if (!mapped) {
      throw this.notFound();
    }

    return {
      ...mapped.summary,
      colorings: mapped.colorings,
    };
  }

  private mapCollection(collection: PublicCollectionRecord) {
    if (!this.hasCompleteCover(collection) || !collection.publishedAt) {
      return null;
    }

    const colorings = collection.colorings.filter((coloring) =>
      this.isEligibleColoring(coloring),
    );

    if (colorings.length === 0) {
      return null;
    }

    const summary = {
      id: collection.id,
      slug: collection.slug,
      title: collection.title,
      ...(collection.description?.trim()
        ? { description: collection.description }
        : {}),
      coloringCount: colorings.length,
      expectedColoringCount: collection.expectedColoringCount,
      cover: {
        url: collection.coverUrl,
        alt: collection.coverAlt,
        width: collection.coverWidth,
        height: collection.coverHeight,
      },
      product: {
        id: collection.product.id,
        slug: collection.product.slug,
        title: collection.product.title,
        ...(collection.product.category
          ? {
              category: {
                id: collection.product.category.id,
                slug: collection.product.category.slug,
                title: collection.product.category.title,
              },
            }
          : {}),
      },
      lastModified: this.getLastModified(collection, colorings).toISOString(),
    };

    return {
      summary,
      colorings: colorings.map((coloring) => {
        const revision = coloring.publishedRevision;
        const dimensions = this.getCardDimensions(revision);
        const version = this.getCardVersion(revision);

        return {
          id: coloring.id,
          number: coloring.number,
          title: coloring.title,
          position: coloring.position,
          publishedRevisionId: coloring.publishedRevisionId,
          card: {
            url: `${this.getApiPublicUrl()}/colorings/${encodeURIComponent(collection.slug)}/${formatColoringNumber(coloring.number)}/assets/${encodeURIComponent(revision.id)}/card/content?v=${version}`,
            alt: revision.coloredAlt,
            width: dimensions.width,
            height: dimensions.height,
          },
        };
      }),
    };
  }

  private isEligibleColoring(
    coloring: PublicCollectionColoring,
  ): coloring is PublicCollectionColoring & {
    description: string;
    publishedRevisionId: string;
    publishedAt: Date;
    publishedRevision: NonNullable<
      PublicCollectionColoring["publishedRevision"]
    > & {
      firstPublishedAt: Date;
    };
  } {
    return Boolean(
      coloring.description?.trim() &&
      coloring.publishedRevisionId &&
      coloring.publishedAt &&
      coloring.publishedRevision?.firstPublishedAt,
    );
  }

  private hasCompleteCover(collection: PublicCollectionRecord): collection is
    PublicCollectionRecord & {
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

  private getCardDimensions(
    revision: NonNullable<PublicCollectionColoring["publishedRevision"]>,
  ) {
    if (
      revision.cardStorageKey &&
      revision.cardByteSize &&
      revision.cardChecksum &&
      revision.cardWidth &&
      revision.cardHeight
    ) {
      return { width: revision.cardWidth, height: revision.cardHeight };
    }

    return { width: revision.width, height: revision.height };
  }

  private getCardVersion(
    revision: NonNullable<PublicCollectionColoring["publishedRevision"]>,
  ) {
    if (
      revision.cardStorageKey &&
      revision.cardByteSize &&
      revision.cardChecksum &&
      revision.cardWidth &&
      revision.cardHeight
    ) {
      return revision.cardChecksum;
    }

    return revision.coloredChecksum;
  }

  private getLastModified(
    collection: PublicCollectionRecord,
    colorings: Array<
      PublicCollectionColoring & {
        publishedRevision: NonNullable<
          PublicCollectionColoring["publishedRevision"]
        >;
      }
    >,
  ) {
    return new Date(
      Math.max(
        collection.updatedAt.getTime(),
        collection.publishedAt?.getTime() ?? 0,
        collection.product.updatedAt.getTime(),
        collection.product.category?.updatedAt.getTime() ?? 0,
        ...colorings.flatMap((coloring) => [
          coloring.updatedAt.getTime(),
          coloring.publishedAt?.getTime() ?? 0,
          coloring.publishedRevision.firstPublishedAt?.getTime() ?? 0,
          ...coloring.themes.map(({ tag }) => tag.updatedAt.getTime()),
        ]),
      ),
    );
  }

  private notFound() {
    return new NotFoundException("Coloring collection not found");
  }

  private getApiPublicUrl() {
    return (
      process.env.API_PUBLIC_URL ??
      process.env.API_BASE_URL ??
      `http://localhost:${process.env.PORT ?? "3002"}`
    ).replace(/\/+$/, "");
  }
}
