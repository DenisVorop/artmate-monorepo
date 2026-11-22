import { randomBytes } from "node:crypto";

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { Prisma, WorkshopReportReason } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateWorkshopReportDTO } from "./dto";
import { publicWorkshopWorkWhere } from "./workshop-eligibility";
import { WorkshopStorageService } from "./workshop-storage.service";
import {
  isReadyPublishedArtwork,
  publicOriginalAssetUrl,
  publicArtworkSelect,
} from "../colorings/public-coloring-variant-eligibility";

import {
  contestEntryInclude,
  mapContestGalleryWork,
  publicContestEntryWhere,
} from "../contests/contest-entry-read-model";

const publicWorkInclude = {
  workshop: {
    select: { handle: true, owner: { select: { name: true, image: true } } },
  },
  coloring: {
    select: {
      number: true,
      title: true,
      artwork: { select: publicArtworkSelect },
      collection: {
        select: {
          slug: true,
          title: true,
          product: {
            select: {
              slug: true,
              title: true,
              category: { select: { slug: true } },
            },
          },
        },
      },
    },
  },
  publishedRevision: {
    include: {
      materials: { orderBy: { position: "asc" } },
      symbolMappings: { orderBy: { symbol: "asc" } },
      officialRevision: {
        select: {
          id: true,
          version: true,
          paletteLabel: true,
          paletteVersion: true,
          paletteColors: { orderBy: { symbolPosition: "asc" } },
        },
      },
    },
  },
} satisfies Prisma.WorkshopWorkInclude;

type PublicWork = Prisma.WorkshopWorkGetPayload<{
  include: typeof publicWorkInclude;
}>;

@Injectable()
export class PublicWorkshopService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: WorkshopStorageService,
  ) {}

  async getWorkshop(handle: string) {
    const workshop = await this.prisma.workshop.findFirst({
      where: {
        handle,
        isPublic: true,
        owner: { is: { status: "ACTIVE", deletedAt: null } },
      },
      select: {
        handle: true,
        owner: { select: { name: true, image: true } },
        works: {
          where: publicWorkshopWorkWhere,
          include: publicWorkInclude,
          orderBy: { createdAt: "desc" },
          take: 500,
        },
      },
    });

    if (!workshop) {
      throw this.notFound();
    }

    return {
      handle: workshop.handle,
      author: {
        name: workshop.owner.name?.trim() || "Автор",
        image: workshop.owner.image?.trim() || undefined,
      },
      works: workshop.works
        .filter((work) => work.publishedRevision)
        .map((work) => this.mapWork(work as PublicWork)),
    };
  }

  async getWork(publicId: string) {
    const work = await this.findPublicWork(publicId);
    return this.mapWork(work);
  }

  async getColoringWorks(collectionSlug: string, number: number) {
    const works = await this.prisma.workshopWork.findMany({
      where: {
        AND: [
          publicWorkshopWorkWhere,
          {
            coloring: {
              is: { number, collection: { is: { slug: collectionSlug } } },
            },
          },
        ],
      },
      include: publicWorkInclude,
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    return works
      .filter((work) => work.publishedRevision)
      .map((work) => this.mapWork(work as PublicWork));
  }

  async getCollectionWorks(collectionSlug: string, cursor?: string) {
    return this.getWorksPage(12, cursor, [collectionSlug]);
  }

  async getGalleryFilters() {
    const works = await this.prisma.workshopWork.findMany({
      where: publicWorkshopWorkWhere,
      distinct: ["coloringId"],
      select: {
        coloring: {
          select: {
            number: true,
            collection: { select: { slug: true, title: true } },
          },
        },
      },
    });
    const collections = new Map<
      string,
      { slug: string; title: string; numbers: number[] }
    >();
    for (const { coloring } of works) {
      const collection = collections.get(coloring.collection.slug) ?? {
        ...coloring.collection,
        numbers: [],
      };
      if (!collection.numbers.includes(coloring.number))
        collection.numbers.push(coloring.number);
      collections.set(collection.slug, collection);
    }
    const contestAlbums = await this.prisma.$queryRaw<
      Array<{ slug: string; title: string; number: number | null }>
    >`
      SELECT COALESCE(cc.slug, p.slug) AS slug, p.title, r.number
      FROM contest_entries e
      JOIN contests c ON c.id = e.contest_id
      JOIN users u ON u.id = e.user_id
      JOIN contest_entry_revisions r ON r.entry_id = e.id AND r.sequence = e.revision
      JOIN products p ON p.id = r.product_id
      LEFT JOIN coloring_collections cc ON cc.product_id = p.id
      WHERE e.status = 'APPROVED' AND e.published_at IS NOT NULL AND c.published
        AND (e.publication_ends_at IS NULL OR e.publication_ends_at > CURRENT_TIMESTAMP)
        AND u.status = 'active' AND u.deleted_at IS NULL
    `;
    for (const album of contestAlbums) {
      const collection = collections.get(album.slug) ?? {
        slug: album.slug,
        title: album.title,
        numbers: [],
      };
      if (album.number !== null && !collection.numbers.includes(album.number))
        collection.numbers.push(album.number);
      collections.set(album.slug, collection);
    }
    return {
      collections: [...collections.values()]
        .map((collection) => ({
          ...collection,
          numbers: collection.numbers.sort((a, b) => a - b),
        }))
        .sort((a, b) => a.title.localeCompare(b.title, "ru")),
    };
  }

  async getGalleryWorks(
    cursor?: string,
    collectionSlugs: string[] = [],
    number?: number,
  ) {
    if (
      !Array.isArray(collectionSlugs) ||
      collectionSlugs.length > 30 ||
      collectionSlugs.some(
        (value) =>
          typeof value !== "string" || !/^[a-z0-9-]{1,180}$/.test(value),
      ) ||
      (number !== undefined &&
        (!Number.isInteger(number) || number < 1 || number > 99))
    ) {
      throw new BadRequestException("Invalid gallery filter");
    }
    return this.getMixedGalleryPage(60, cursor, collectionSlugs, number);
  }

  private async getMixedGalleryPage(
    pageSize: number,
    cursor: string | undefined,
    collections: string[],
    number?: number,
  ) {
    let point: { at: Date; id: string; source: string } | undefined;
    if (cursor !== undefined) {
      const match =
        /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)_(workshop|contest)_([0-9a-f]{32})$/.exec(
          cursor,
        );
      if (
        !match ||
        !Number.isFinite(Date.parse(match[1]!)) ||
        new Date(match[1]!).toISOString() !== match[1]
      )
        throw new BadRequestException("Invalid works cursor");
      point = { at: new Date(match[1]!), source: match[2]!, id: match[3]! };
    }
    const workshopAfter = point
      ? [
          {
            OR: [
              { publishedAt: { lt: point.at } },
              { publishedAt: point.at, id: { lt: point.id } },
            ],
          },
        ]
      : [];
    const contestAfter = point
      ? Prisma.sql`AND (e.published_at < ${point.at} OR (e.published_at = ${point.at} AND ${point.source === "workshop" ? Prisma.sql`e.id <= ${point.id}` : Prisma.sql`e.id < ${point.id}`}))`
      : Prisma.empty;
    const [workshops, contestIds] = await Promise.all([
      this.prisma.workshopWork.findMany({
        where: {
          AND: [
            publicWorkshopWorkWhere,
            ...(collections.length
              ? [
                  {
                    coloring: {
                      is: { collection: { is: { slug: { in: collections } } } },
                    },
                  },
                ]
              : []),
            ...(number !== undefined ? [{ coloring: { is: { number } } }] : []),
            ...workshopAfter,
          ],
        },
        include: publicWorkInclude,
        orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
        take: pageSize + 1,
      }),
      this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT e.id FROM contest_entries e
        JOIN contests c ON c.id = e.contest_id
        JOIN users u ON u.id = e.user_id
        JOIN contest_entry_revisions r ON r.entry_id = e.id AND r.sequence = e.revision
        JOIN products p ON p.id = r.product_id
        LEFT JOIN coloring_collections cc ON cc.product_id = p.id
        WHERE e.status = 'APPROVED' AND e.published_at IS NOT NULL AND c.published
          AND (e.publication_ends_at IS NULL OR e.publication_ends_at > CURRENT_TIMESTAMP)
          AND u.status = 'active' AND u.deleted_at IS NULL
          ${collections.length ? Prisma.sql`AND COALESCE(cc.slug, p.slug) IN (${Prisma.join(collections)})` : Prisma.empty}
          ${number === undefined ? Prisma.empty : Prisma.sql`AND r.number = ${number}`}
          ${contestAfter}
        ORDER BY e.published_at DESC, e.id DESC LIMIT ${pageSize + 1}
      `),
    ]);
    const contests = contestIds.length
      ? await this.prisma.contestEntry.findMany({
          where: {
            ...publicContestEntryWhere(),
            id: { in: contestIds.map((row) => row.id) },
          },
          include: contestEntryInclude,
        })
      : [];
    const candidates = [
      ...workshops.map((work) => ({
        id: work.id,
        at: work.publishedAt!,
        source: "workshop" as const,
        work: { ...this.mapWork(work), source: "workshop" as const },
      })),
      ...contests.map((entry) => ({
        id: entry.id,
        at: entry.publishedAt!,
        source: "contest" as const,
        work: mapContestGalleryWork(entry),
      })),
    ].sort(
      (a, b) =>
        b.at.getTime() - a.at.getTime() ||
        (a.id < b.id ? 1 : a.id > b.id ? -1 : a.source < b.source ? 1 : -1),
    );
    const page = candidates.slice(0, pageSize),
      last = page.at(-1);
    return {
      works: page.map((item) => item.work),
      nextCursor:
        candidates.length > pageSize && last
          ? `${last.at.toISOString()}_${last.source}_${last.id}`
          : null,
    };
  }

  private async getWorksPage(
    pageSize: number,
    cursor?: string,
    collectionSlugs: string[] = [],
    number?: number,
  ) {
    const after: Prisma.WorkshopWorkWhereInput[] = [];
    if (cursor !== undefined) {
      const match =
        typeof cursor === "string" &&
        /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)_([0-9a-f]{32})$/.exec(
          cursor,
        );
      if (!match || !Number.isFinite(Date.parse(match[1]!))) {
        throw new BadRequestException("Invalid works cursor");
      }
      const publishedAt = new Date(match[1]!);
      if (publishedAt.toISOString() !== match[1]) {
        throw new BadRequestException("Invalid works cursor");
      }
      after.push({
        OR: [
          { publishedAt: { lt: publishedAt } },
          { publishedAt, id: { lt: match[2]! } },
        ],
      });
    }
    const works = await this.prisma.workshopWork.findMany({
      where: {
        AND: [
          publicWorkshopWorkWhere,
          ...(collectionSlugs.length
            ? [
                {
                  coloring: {
                    is: {
                      collection: { is: { slug: { in: collectionSlugs } } },
                    },
                  },
                },
              ]
            : []),
          ...(number !== undefined ? [{ coloring: { is: { number } } }] : []),
          ...after,
        ],
      },
      include: publicWorkInclude,
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      take: pageSize + 1,
    });
    const page = works.slice(0, pageSize);
    const last = page.at(-1);
    return {
      works: page
        .filter((work) => work.publishedRevision)
        .map((work) => this.mapWork(work as PublicWork)),
      nextCursor:
        works.length > pageSize && last?.publishedAt
          ? `${last.publishedAt.toISOString()}_${last.id}`
          : null,
    };
  }

  async getAsset(publicId: string, variant: string, width?: number) {
    const assetVariant = this.parsePublicVariant(variant);
    const work = await this.findPublicWork(publicId);
    const revision = work.publishedRevision;

    if (!revision) {
      throw this.notFound();
    }

    return this.storage.read(
      revision[`${assetVariant}StorageKey`],
      {
        checksum: revision[`${assetVariant}Checksum`],
        width: revision[`${assetVariant}Width`],
        height: revision[`${assetVariant}Height`],
      },
      width,
    );
  }

  async report(
    publicId: string,
    reporterId: string,
    input: CreateWorkshopReportDTO,
  ) {
    const work = await this.findPublicWork(publicId);

    if (work.publishedRevision!.id !== input.revisionId) {
      throw new ConflictException(
        "Work publication changed; reload before reporting",
      );
    }

    try {
      const report = await this.prisma.workshopWorkReport.create({
        data: {
          id: randomBytes(16).toString("hex"),
          workId: work.id,
          revisionId: input.revisionId,
          reporterId,
          reason: WorkshopReportReason[input.reason],
          details: input.details ?? null,
        },
      });

      return {
        status: report.status,
        createdAt: report.createdAt.toISOString(),
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("Work was already reported by this user");
      }

      throw error;
    }
  }

  private async findPublicWork(publicId: string) {
    const work = await this.prisma.workshopWork.findFirst({
      where: { AND: [publicWorkshopWorkWhere, { publicId }] },
      include: publicWorkInclude,
    });

    if (!work?.publishedRevision) {
      throw this.notFound();
    }

    return work as PublicWork;
  }

  private mapWork(work: PublicWork) {
    const revision = work.publishedRevision!;
    const official = revision.officialRevision;
    const collectionSlug = work.coloring.collection.slug;
    const number = String(work.coloring.number).padStart(2, "0");
    const original = isReadyPublishedArtwork(work.coloring.artwork)
      ? work.coloring.artwork.original
      : null;

    return {
      revisionId: revision.id,
      publicId: work.publicId,
      author: {
        handle: work.workshop.handle,
        name: work.workshop.owner.name?.trim() || "Автор",
        image: work.workshop.owner.image?.trim() || undefined,
      },
      official: {
        collection: {
          slug: collectionSlug,
          title: work.coloring.collection.title,
        },
        coloring: { number: work.coloring.number, title: work.coloring.title },
        coloredUrl: original
          ? publicOriginalAssetUrl(
              this.apiUrl(),
              collectionSlug,
              work.coloring.number,
              "colored",
              original.imageChecksum,
            )
          : `${this.apiUrl()}/colorings/${encodeURIComponent(collectionSlug)}/${number}/assets/${official.id}/colored/content`,
        palette: {
          label: official.paletteLabel,
          version: official.paletteVersion,
          colors: official.paletteColors.map((color) => ({
            symbolPosition: color.symbolPosition,
            symbol: this.symbol(color.symbolPosition),
            colorNumber: color.colorNumber,
            pantone: color.pantone,
            hex: color.hex,
            markerNumber: color.markerNumber,
          })),
        },
      },
      relatedProduct: {
        slug: work.coloring.collection.product.slug,
        title: work.coloring.collection.product.title,
        categorySlug:
          work.coloring.collection.product.category?.slug ?? undefined,
      },
      submission: {
        caption: revision.caption ?? undefined,
        materials: revision.materials.map((material) => ({
          position: material.position,
          type: material.toolType,
          brand: material.brand,
          line: material.line,
        })),
        symbolMappings: revision.symbolMappings.map((mapping) => ({
          symbol: mapping.symbol,
          materialPosition: mapping.materialPosition,
          markerNumber: mapping.markerNumber,
          ...(mapping.officialMarkerColorId
            ? {
                officialColor: {
                  colorNumber: mapping.officialColorNumber,
                  pantone: mapping.officialPantone,
                  hex: mapping.officialHex,
                  markerNumber: mapping.officialMarkerNumber,
                },
              }
            : {}),
        })),
        assets: {
          web: `${this.apiUrl()}/club/works/${work.publicId}/assets/web`,
          thumb: `${this.apiUrl()}/club/works/${work.publicId}/assets/thumb`,
        },
        publishedAt: work.publishedAt!.toISOString(),
      },
    };
  }

  private parsePublicVariant(value: string) {
    if (value !== "web" && value !== "thumb") {
      throw this.notFound();
    }

    return value;
  }

  private symbol(position: number) {
    return position <= 9
      ? String(position)
      : String.fromCharCode(55 + position);
  }

  private apiUrl() {
    return (process.env.API_PUBLIC_URL ?? "http://localhost:3002").replace(
      /\/+$/,
      "",
    );
  }

  private notFound() {
    return new NotFoundException("Club resource not found");
  }
}
