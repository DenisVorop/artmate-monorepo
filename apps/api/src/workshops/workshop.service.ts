import { randomBytes } from "node:crypto";

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { ColoringStorageService } from "../colorings/coloring-storage.service";
import {
  ColoringCollectionStatus,
  ColoringStatus,
  Prisma,
  WorkshopCollectionSource,
  WorkshopModerationDecision,
  WorkshopRevisionStatus,
  WorkshopToolType,
  type WorkshopWorkRevision,
} from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type {
  AddWorkshopCollectionDTO,
  CreateWorkshopToolDTO,
  UpdateWorkshopVisibilityDTO,
  WorkshopRevisionPayloadDTO,
} from "./dto";
import { WorkshopAssetDeletionQueueService } from "./workshop-asset-deletion-queue.service";
import {
  WorkshopMediaService,
  type ProcessedWorkshopPhoto,
  type WorkshopUploadedFile,
} from "./workshop-media.service";
import { WorkshopStorageService } from "./workshop-storage.service";

const revisionInclude = {
  materials: { orderBy: { position: "asc" } },
  symbolMappings: { orderBy: { symbol: "asc" } },
  moderationEvents: {
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { reason: true },
  },
} satisfies Prisma.WorkshopWorkRevisionInclude;

const workInclude = {
  currentRevision: { include: revisionInclude },
  publishedRevision: { include: revisionInclude },
} satisfies Prisma.WorkshopWorkInclude;

type StoredRevision = Prisma.WorkshopWorkRevisionGetPayload<{
  include: typeof revisionInclude;
}>;

@Injectable()
export class WorkshopService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: WorkshopMediaService,
    private readonly storage: WorkshopStorageService,
    private readonly coloringStorage: ColoringStorageService,
    private readonly deletionQueue: WorkshopAssetDeletionQueueService,
  ) {}

  async getMine(userId: string) {
    const workshop = await this.getOrCreateWorkshop(userId);
    const paidProductIds = await this.getPaidProductIds(userId);
    await this.syncPurchasedCollections(workshop.id, paidProductIds);
    const collections = await this.prisma.workshopCollection.findMany({
      where: {
        workshopId: workshop.id,
        collection: { is: { status: ColoringCollectionStatus.PUBLISHED } },
      },
      include: {
        collection: {
          select: {
            id: true,
            slug: true,
            title: true,
            productId: true,
            expectedColoringCount: true,
            coverUrl: true,
            coverAlt: true,
            coverWidth: true,
            coverHeight: true,
          },
        },
        _count: { select: { works: { where: { deletedAt: null } } } },
      },
      orderBy: { addedAt: "asc" },
      take: 500,
    });

    return {
      handle: workshop.handle,
      isPublic: workshop.isPublic,
      isIndexable: workshop.isIndexable,
      collections: collections.map((membership) =>
        this.mapCollectionSummary(membership, paidProductIds),
      ),
      createdAt: workshop.createdAt.toISOString(),
      updatedAt: workshop.updatedAt.toISOString(),
    };
  }

  async updateVisibility(userId: string, input: UpdateWorkshopVisibilityDTO) {
    const workshop = await this.getOrCreateWorkshop(userId);

    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "workshops" WHERE "id" = ${workshop.id} FOR UPDATE`,
      );
      const lockedWorkshop = await tx.workshop.findUnique({
        where: { id: workshop.id },
        select: { isPublic: true },
      });

      if (!lockedWorkshop) {
        throw this.notFound();
      }

      await tx.workshop.update({
        where: { id: workshop.id },
        data: {
          isPublic: input.isPublic,
          ...(!input.isPublic ? { isIndexable: false } : {}),
        },
      });

      if (!input.isPublic) {
        await tx.workshopWork.updateMany({
          where: { workshopId: workshop.id },
          data: {
            isPublicationEnabled: false,
            isIndexable: false,
            publishedAt: null,
          },
        });
      } else if (!lockedWorkshop.isPublic) {
        await tx.workshopWork.updateMany({
          where: {
            workshopId: workshop.id,
            deletedAt: null,
            isPublicationEnabled: true,
            publishedRevision: {
              is: { status: WorkshopRevisionStatus.APPROVED },
            },
          },
          data: { publishedAt: new Date() },
        });
      }
    });

    return this.getMine(userId);
  }

  async addCollection(userId: string, input: AddWorkshopCollectionDTO) {
    const workshop = await this.getOrCreateWorkshop(userId);
    const collection = await this.prisma.coloringCollection.findUnique({
      where: {
        slug: input.collectionSlug,
        status: ColoringCollectionStatus.PUBLISHED,
      },
      select: { id: true },
    });

    if (!collection) {
      throw this.notFound();
    }

    await this.prisma.workshopCollection.upsert({
      where: {
        workshopId_collectionId: {
          workshopId: workshop.id,
          collectionId: collection.id,
        },
      },
      create: {
        workshopId: workshop.id,
        collectionId: collection.id,
        source: WorkshopCollectionSource.MANUAL,
      },
      update: {},
    });

    return this.getCollection(userId, input.collectionSlug);
  }

  async getCollection(userId: string, collectionSlug: string) {
    const membership = await this.prisma.workshopCollection.findFirst({
      where: {
        workshop: { is: { ownerId: userId } },
        collection: {
          is: {
            slug: collectionSlug,
            status: ColoringCollectionStatus.PUBLISHED,
          },
        },
      },
      include: {
        collection: {
          include: {
            colorings: {
              where: {
                status: ColoringStatus.PUBLISHED,
                publishedRevisionId: { not: null },
              },
              select: {
                id: true,
                number: true,
                title: true,
                publishedRevision: {
                  select: {
                    id: true,
                    coloredAlt: true,
                    coloredChecksum: true,
                    width: true,
                    height: true,
                    cardChecksum: true,
                    cardWidth: true,
                    cardHeight: true,
                  },
                },
              },
              orderBy: { number: "asc" },
              take: 500,
            },
          },
        },
        works: {
          where: { deletedAt: null },
          include: workInclude,
          take: 500,
        },
        _count: { select: { works: { where: { deletedAt: null } } } },
      },
    });

    if (!membership) {
      throw this.notFound();
    }

    const paidProductIds = await this.getPaidProductIds(userId);
    const works = new Map(
      membership.works.map((work) => [work.coloringId, work]),
    );

    return {
      ...this.mapCollectionSummary(membership, paidProductIds),
      description: membership.collection.description ?? "",
      colorings: membership.collection.colorings.map((coloring) => {
        const work = works.get(coloring.id);
        return {
          id: coloring.id,
          number: coloring.number,
          title: coloring.title,
          officialImage: this.mapOfficialImage(
            membership.collection.slug,
            coloring.number,
            coloring.publishedRevision!,
          ),
          ...(work
            ? {
                work: this.mapWork(work),
              }
            : {}),
        };
      }),
    };
  }

  async getColoring(userId: string, collectionSlug: string, number: number) {
    const membership = await this.prisma.workshopCollection.findFirst({
      where: {
        workshop: { is: { ownerId: userId } },
        collection: {
          is: {
            slug: collectionSlug,
            status: ColoringCollectionStatus.PUBLISHED,
          },
        },
      },
      select: {
        workshopId: true,
        collection: { select: { id: true, slug: true, title: true } },
      },
    });

    if (!membership) {
      throw this.notFound();
    }

    const coloring = await this.prisma.coloring.findUnique({
      where: {
        collectionId_number: {
          collectionId: membership.collection.id,
          number,
        },
        status: ColoringStatus.PUBLISHED,
      },
      select: {
        id: true,
        number: true,
        title: true,
        description: true,
        publishedRevision: {
          select: {
            id: true,
            version: true,
            paletteLabel: true,
            paletteVersion: true,
            paletteColors: {
              orderBy: { symbolPosition: "asc" },
              select: {
                symbolPosition: true,
                markerColorId: true,
                colorNumber: true,
                pantone: true,
                hex: true,
                markerNumber: true,
              },
            },
            coloredAlt: true,
            coloredChecksum: true,
            width: true,
            height: true,
            cardChecksum: true,
            cardWidth: true,
            cardHeight: true,
          },
        },
      },
    });

    if (!coloring?.publishedRevision) {
      throw this.notFound();
    }

    const work = await this.prisma.workshopWork.findFirst({
      where: {
        workshopId: membership.workshopId,
        coloringId: coloring.id,
        deletedAt: null,
      },
      orderBy: { attemptNumber: "desc" },
      include: workInclude,
    });

    return {
      collection: membership.collection,
      coloring: {
        id: coloring.id,
        number: coloring.number,
        title: coloring.title,
        description: coloring.description ?? "",
        officialImage: this.mapOfficialImage(
          membership.collection.slug,
          coloring.number,
          coloring.publishedRevision,
        ),
        officialRevision: this.mapOfficialRevision(coloring.publishedRevision),
      },
      ...(work ? { work: this.mapWork(work) } : {}),
    };
  }

  async createRevision(
    userId: string,
    collectionSlug: string,
    number: number,
    input: WorkshopRevisionPayloadDTO,
    photo: WorkshopUploadedFile | undefined,
  ) {
    const context = await this.getRevisionContext(
      userId,
      collectionSlug,
      number,
    );
    const workId = context.work?.id ?? this.randomId();
    const revisionId = this.randomId();
    const current = context.work?.currentRevision;

    if (current?.status === WorkshopRevisionStatus.PENDING) {
      throw new ConflictException(
        "A pending revision must be moderated before editing",
      );
    }

    if (!photo && !current) {
      throw new BadRequestException("Photo is required for the first revision");
    }

    if (!photo && current?.status === WorkshopRevisionStatus.HIDDEN) {
      throw new BadRequestException(
        "A new photo is required after a policy rejection",
      );
    }

    const materials = await this.getMaterialSnapshots(userId, input.materials);
    const mappings = await this.getMappingSnapshots(
      input.symbolMappings,
      materials,
    );
    let processed: ProcessedWorkshopPhoto | undefined;
    let storedKeys: string[] = [];

    if (photo) {
      const official = context.coloring.publishedRevision;
      const officialBuffer = await this.coloringStorage.readProtected(
        official.coloredStorageKey,
        {
          checksum: official.coloredChecksum,
          width: official.width,
          height: official.height,
        },
      );
      processed = await this.media.processPhoto(
        photo,
        input.crop,
        officialBuffer,
      );

      if (
        [
          official.coloredSourceChecksum,
          official.coloredChecksum,
          official.cardChecksum,
        ].includes(processed.sourceChecksum)
      ) {
        throw new BadRequestException(
          "Official colored image cannot be uploaded",
        );
      }

      const entries = this.storageEntries(workId, revisionId, processed);
      const stored = await this.storage.writeAssets(entries);
      storedKeys = stored
        .filter(({ created }) => created)
        .map(({ key }) => key);
    }

    const media = processed
      ? this.mediaData(workId, revisionId, processed)
      : this.reusedMediaData(current!);
    const appliedCrop = processed
      ? input.crop
      : {
          rotation: current!.cropRotation as 0 | 90 | 180 | 270,
          zoom: current!.cropZoom,
          x: current!.cropX,
          y: current!.cropY,
        };

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        if (context.work) {
          await tx.$queryRaw(
            Prisma.sql`SELECT "id" FROM "workshop_works" WHERE "id" = ${workId} FOR UPDATE`,
          );
          const locked = await tx.workshopWork.findFirst({
            where: {
              id: workId,
              workshop: { is: { ownerId: userId } },
              deletedAt: null,
            },
            include: { currentRevision: true },
          });

          if (!locked || locked.currentRevisionId !== current?.id) {
            throw new ConflictException("Workshop work changed concurrently");
          }

          if (
            !photo &&
            locked.currentRevision?.status === WorkshopRevisionStatus.HIDDEN
          ) {
            throw new ConflictException(
              "A new photo is required after a policy rejection",
            );
          }
        } else {
          await this.createNextWorkAttempt(tx, {
            id: workId,
            publicId: this.randomPublicId(),
            workshopId: context.workshopId,
            collectionId: context.collectionId,
            coloringId: context.coloring.id,
          });
        }

        const sequence = await tx.workshopWork.update({
          where: { id: workId },
          data: { revisionSequence: { increment: 1 } },
          select: { revisionSequence: true },
        });
        const submittedAt = new Date();
        await tx.workshopWorkRevision.create({
          data: {
            id: revisionId,
            workId,
            coloringId: context.coloring.id,
            sequence: sequence.revisionSequence,
            officialRevisionId: processed
              ? context.coloring.publishedRevision.id
              : current!.officialRevisionId,
            status: WorkshopRevisionStatus.PENDING,
            caption: input.caption ?? null,
            advertisingConsent: input.advertisingConsent,
            advertisingConsentAt: input.advertisingConsent ? submittedAt : null,
            cropRotation: appliedCrop.rotation,
            cropZoom: appliedCrop.zoom,
            cropX: appliedCrop.x,
            cropY: appliedCrop.y,
            ...media,
            submittedAt,
            materials: {
              create: materials.map((material, index) => ({
                ...material,
                position: index + 1,
              })),
            },
            symbolMappings: { create: mappings },
          },
        });
        await tx.workshopWork.update({
          where: { id: workId },
          data: { currentRevisionId: revisionId },
        });

        await tx.workshopModerationEvent.create({
          data: {
            id: this.randomId(),
            workId,
            revisionId,
            actorId: userId,
            decision: WorkshopModerationDecision.SUBMITTED,
          },
        });

        return tx.workshopWork.findUnique({
          where: { id: workId },
          include: workInclude,
        });
      });

      if (!created) {
        throw new Error("Created workshop work could not be loaded");
      }

      return this.mapWork(created);
    } catch (error) {
      let committed: StoredRevision | null;

      try {
        committed = await this.prisma.workshopWorkRevision.findUnique({
          where: { id: revisionId },
          include: revisionInclude,
        });
      } catch {
        // The transaction outcome is ambiguous. Never delete files which may
        // already be referenced by a committed revision.
        throw error;
      }

      if (committed) {
        const work = await this.prisma.workshopWork.findUnique({
          where: { id: workId },
          include: workInclude,
        });

        if (work) {
          return this.mapWork(work);
        }
      }

      if (storedKeys.length > 0) {
        await this.storage.cleanup(storedKeys);
      }

      throw error;
    }
  }

  async publish(userId: string, workId: string) {
    return this.setPublication(userId, workId, true);
  }

  async unpublish(userId: string, workId: string) {
    return this.setPublication(userId, workId, false);
  }

  async deleteWork(userId: string, workId: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "workshop_works" WHERE "id" = ${workId} FOR UPDATE`,
      );
      const work = await tx.workshopWork.findFirst({
        where: {
          id: workId,
          workshop: { is: { ownerId: userId } },
          deletedAt: null,
        },
        include: {
          currentRevision: { select: { status: true } },
          revisions: {
            select: {
              normalizedStorageKey: true,
              webStorageKey: true,
              thumbStorageKey: true,
            },
          },
        },
      });

      if (!work) {
        throw this.notFound();
      }

      if (work.currentRevision?.status === WorkshopRevisionStatus.PENDING) {
        throw new ConflictException(
          "A pending revision cannot be deleted before moderation",
        );
      }

      await this.deletionQueue.enqueue(
        tx,
        work.revisions.flatMap((revision) => [
          revision.normalizedStorageKey,
          revision.webStorageKey,
          revision.thumbStorageKey,
        ]),
      );

      await tx.workshopWork.update({
        where: { id: work.id },
        data: {
          deletedAt: new Date(),
          isPublicationEnabled: false,
          isIndexable: false,
          publishedAt: null,
        },
      });
    });
  }

  async getTools(userId: string) {
    await this.prisma.workshopTool.upsert({
      where: {
        userId_type_brand_line: {
          userId,
          type: WorkshopToolType.ARTMATE_168,
          brand: "Artmate",
          line: "168",
        },
      },
      create: {
        id: this.randomId(),
        userId,
        type: WorkshopToolType.ARTMATE_168,
        brand: "Artmate",
        line: "168",
      },
      update: {},
    });
    const [tools, palette] = await Promise.all([
      this.prisma.workshopTool.findMany({
        where: { userId },
        orderBy: [{ type: "asc" }, { createdAt: "asc" }],
        take: 500,
      }),
      this.prisma.markerColor.findMany({ orderBy: { catalogPosition: "asc" } }),
    ]);

    return tools.map((tool) => ({
      id: tool.id,
      type: tool.type,
      brand: tool.brand,
      line: tool.line,
      ...(tool.type === WorkshopToolType.ARTMATE_168
        ? {
            officialPalette: palette.map((color) => ({
              id: color.id,
              colorNumber: color.colorNumber,
              pantone: color.pantone,
              hex: color.hex,
              markerNumber: color.markerNumber,
            })),
          }
        : {}),
    }));
  }

  async createTool(userId: string, input: CreateWorkshopToolDTO) {
    const type = WorkshopToolType[input.type];
    const claimsCanonicalArtmateSet =
      input.brand.toLocaleLowerCase("en-US") === "artmate" &&
      input.line === "168";

    if (
      (type === WorkshopToolType.ARTMATE_168 &&
        (input.brand !== "Artmate" || input.line !== "168")) ||
      (type === WorkshopToolType.CUSTOM && claimsCanonicalArtmateSet)
    ) {
      throw new BadRequestException(
        "Artmate 168 identity is reserved for its official catalog",
      );
    }

    try {
      const created = await this.prisma.workshopTool.create({
        data: {
          id: this.randomId(),
          userId,
          type,
          brand: input.brand,
          line: input.line,
        },
      });

      const tools = await this.getTools(userId);
      return tools.find((tool) => tool.id === created.id)!;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("Workshop tool already exists");
      }

      throw error;
    }
  }

  async getOwnerAsset(userId: string, revisionId: string, variant: string) {
    const assetVariant = this.parseVariant(variant);
    const revision = await this.prisma.workshopWorkRevision.findFirst({
      where: {
        id: revisionId,
        status: { not: WorkshopRevisionStatus.HIDDEN },
        work: {
          is: {
            deletedAt: null,
            workshop: { is: { ownerId: userId } },
          },
        },
      },
    });

    if (!revision) {
      throw this.notFound();
    }

    return this.readAsset(revision, assetVariant);
  }

  async getMarkerColors() {
    return this.prisma.markerColor.findMany({
      orderBy: { catalogPosition: "asc" },
    });
  }

  private async setPublication(
    userId: string,
    workId: string,
    enabled: boolean,
  ) {
    const work = await this.findOwnedWork(userId, workId);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "workshop_works" WHERE "id" = ${work.id} FOR UPDATE`,
      );
      const current = await tx.workshopWork.findFirst({
        where: {
          id: work.id,
          workshop: { is: { ownerId: userId } },
          deletedAt: null,
        },
        include: { workshop: true, publishedRevision: true },
      });

      if (!current) {
        throw this.notFound();
      }

      if (
        enabled &&
        (!current.workshop.isPublic ||
          current.publishedRevision?.status !== WorkshopRevisionStatus.APPROVED)
      ) {
        throw new BadRequestException(
          "Open workshop with an approved published revision is required",
        );
      }

      return tx.workshopWork.update({
        where: { id: current.id },
        data: {
          isPublicationEnabled: enabled,
          publishedAt: enabled ? (current.publishedAt ?? new Date()) : null,
          ...(!enabled ? { isIndexable: false } : {}),
        },
        include: workInclude,
      });
    });

    return this.mapWork(updated);
  }

  private async findOwnedWork(userId: string, workId: string) {
    const work = await this.prisma.workshopWork.findFirst({
      where: {
        id: workId,
        workshop: { is: { ownerId: userId } },
        deletedAt: null,
      },
      include: workInclude,
    });

    if (!work) {
      throw this.notFound();
    }

    return work;
  }

  private async getRevisionContext(
    userId: string,
    slug: string,
    number: number,
  ) {
    const membership = await this.prisma.workshopCollection.findFirst({
      where: {
        workshop: { is: { ownerId: userId } },
        collection: {
          is: { slug, status: ColoringCollectionStatus.PUBLISHED },
        },
      },
      select: { workshopId: true, collectionId: true },
    });

    if (!membership) {
      throw this.notFound();
    }

    const coloring = await this.prisma.coloring.findUnique({
      where: {
        collectionId_number: { collectionId: membership.collectionId, number },
        status: ColoringStatus.PUBLISHED,
      },
      select: {
        id: true,
        publishedRevision: {
          select: {
            id: true,
            width: true,
            height: true,
            coloredSourceChecksum: true,
            coloredStorageKey: true,
            coloredChecksum: true,
            cardChecksum: true,
          },
        },
      },
    });

    const publishedRevision = coloring?.publishedRevision;

    if (!coloring || !publishedRevision) {
      throw this.notFound();
    }

    const work = await this.prisma.workshopWork.findFirst({
      where: {
        workshopId: membership.workshopId,
        coloringId: coloring.id,
        deletedAt: null,
      },
      orderBy: { attemptNumber: "desc" },
      include: { currentRevision: true },
    });

    return {
      ...membership,
      coloring: { ...coloring, publishedRevision },
      work,
    };
  }

  private async createNextWorkAttempt(
    tx: Prisma.TransactionClient,
    input: {
      id: string;
      publicId: string;
      workshopId: string;
      collectionId: string;
      coloringId: string;
    },
  ) {
    const membership = await tx.$queryRaw<Array<{ workshopId: string }>>(
      Prisma.sql`
        SELECT "workshop_id" AS "workshopId"
        FROM "workshop_collections"
        WHERE "workshop_id" = ${input.workshopId}
          AND "collection_id" = ${input.collectionId}
        FOR UPDATE
      `,
    );

    if (membership.length !== 1) {
      throw this.notFound();
    }

    const active = await tx.workshopWork.findFirst({
      where: {
        workshopId: input.workshopId,
        coloringId: input.coloringId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (active) {
      throw new ConflictException("An active workshop attempt already exists");
    }

    const previous = await tx.workshopWork.findFirst({
      where: {
        workshopId: input.workshopId,
        coloringId: input.coloringId,
      },
      orderBy: { attemptNumber: "desc" },
      select: { attemptNumber: true },
    });

    return tx.workshopWork.create({
      data: {
        ...input,
        attemptNumber: (previous?.attemptNumber ?? 0) + 1,
      },
    });
  }

  private async getMaterialSnapshots(
    userId: string,
    inputs: WorkshopRevisionPayloadDTO["materials"],
  ) {
    const ids = inputs.map(({ toolId }) => toolId);

    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException("Revision materials must be unique");
    }

    const tools = await this.prisma.workshopTool.findMany({
      where: { id: { in: ids }, userId },
    });
    const byId = new Map(tools.map((tool) => [tool.id, tool]));

    if (byId.size !== ids.length) {
      throw new BadRequestException(
        "Revision material contains an unknown tool",
      );
    }

    return ids.map((id, index) => {
      const tool = byId.get(id)!;
      return {
        position: index + 1,
        toolId: tool.id,
        toolType: tool.type,
        brand: tool.brand,
        line: tool.line,
      };
    });
  }

  private async getMappingSnapshots(
    inputs: WorkshopRevisionPayloadDTO["symbolMappings"],
    materials: Array<{
      position: number;
      toolId: string;
      toolType: WorkshopToolType;
      brand: string;
      line: string;
    }>,
  ) {
    const symbols = inputs.map(({ symbol }) => symbol);

    if (new Set(symbols).size !== symbols.length) {
      throw new BadRequestException("Revision mapping symbols must be unique");
    }

    const officialIds = inputs
      .map(({ officialMarkerColorId }) => officialMarkerColorId)
      .filter((id): id is string => Boolean(id));
    const colors = await this.prisma.markerColor.findMany({
      where: { id: { in: officialIds } },
    });
    const byId = new Map(colors.map((color) => [color.id, color]));

    if (byId.size !== new Set(officialIds).size) {
      throw new BadRequestException(
        "Revision mapping contains an unknown official color",
      );
    }

    const materialsByPosition = new Map(
      materials.map((material) => [material.position, material]),
    );

    return inputs.map((mapping) => {
      const material = materialsByPosition.get(mapping.materialPosition);

      if (!material) {
        throw new BadRequestException(
          "Revision mapping references an unknown material",
        );
      }

      const official = mapping.officialMarkerColorId
        ? byId.get(mapping.officialMarkerColorId)
        : undefined;

      if (
        material.toolType === WorkshopToolType.ARTMATE_168 &&
        mapping.markerNumber.length > 0 &&
        !official
      ) {
        throw new BadRequestException(
          "Known Artmate 168 marker numbers require an official color",
        );
      }

      if (material.toolType === WorkshopToolType.CUSTOM && official) {
        throw new BadRequestException(
          "Custom material mappings cannot claim official colors",
        );
      }

      return {
        symbol: mapping.symbol,
        materialPosition: mapping.materialPosition,
        markerNumber: official?.markerNumber ?? mapping.markerNumber,
        officialMarkerColorId: official?.id ?? null,
        officialColorNumber: official?.colorNumber ?? null,
        officialPantone: official?.pantone ?? null,
        officialHex: official?.hex ?? null,
        officialMarkerNumber: official?.markerNumber ?? null,
      };
    });
  }

  private storageEntries(
    workId: string,
    revisionId: string,
    photo: ProcessedWorkshopPhoto,
  ) {
    return (["normalized", "web", "thumb"] as const).map((variant) => ({
      key: `${workId}/${revisionId}/${variant}-${photo[variant].checksum}.webp`,
      buffer: photo[variant].buffer,
      checksum: photo[variant].checksum,
    }));
  }

  private mediaData(
    workId: string,
    revisionId: string,
    photo: ProcessedWorkshopPhoto,
  ) {
    return {
      sourceMime: photo.sourceMime,
      sourceChecksum: photo.sourceChecksum,
      perceptualHash: photo.perceptualHash,
      suspectedOfficialCopy: photo.suspectedOfficialCopy,
      normalizedStorageKey: `${workId}/${revisionId}/normalized-${photo.normalized.checksum}.webp`,
      normalizedChecksum: photo.normalized.checksum,
      normalizedByteSize: photo.normalized.byteSize,
      normalizedWidth: photo.normalized.width,
      normalizedHeight: photo.normalized.height,
      webStorageKey: `${workId}/${revisionId}/web-${photo.web.checksum}.webp`,
      webChecksum: photo.web.checksum,
      webByteSize: photo.web.byteSize,
      webWidth: photo.web.width,
      webHeight: photo.web.height,
      thumbStorageKey: `${workId}/${revisionId}/thumb-${photo.thumb.checksum}.webp`,
      thumbChecksum: photo.thumb.checksum,
      thumbByteSize: photo.thumb.byteSize,
      thumbWidth: photo.thumb.width,
      thumbHeight: photo.thumb.height,
    };
  }

  private reusedMediaData(revision: WorkshopWorkRevision) {
    return {
      sourceMime: revision.sourceMime,
      sourceChecksum: revision.sourceChecksum,
      perceptualHash: revision.perceptualHash,
      suspectedOfficialCopy: revision.suspectedOfficialCopy,
      normalizedStorageKey: revision.normalizedStorageKey,
      normalizedChecksum: revision.normalizedChecksum,
      normalizedByteSize: revision.normalizedByteSize,
      normalizedWidth: revision.normalizedWidth,
      normalizedHeight: revision.normalizedHeight,
      webStorageKey: revision.webStorageKey,
      webChecksum: revision.webChecksum,
      webByteSize: revision.webByteSize,
      webWidth: revision.webWidth,
      webHeight: revision.webHeight,
      thumbStorageKey: revision.thumbStorageKey,
      thumbChecksum: revision.thumbChecksum,
      thumbByteSize: revision.thumbByteSize,
      thumbWidth: revision.thumbWidth,
      thumbHeight: revision.thumbHeight,
    };
  }

  private mapCollectionSummary(
    membership: {
      source: WorkshopCollectionSource;
      addedAt: Date;
      collection: {
        id: string;
        slug: string;
        title: string;
        productId: string;
        expectedColoringCount: number;
        coverUrl: string | null;
        coverAlt: string | null;
        coverWidth: number | null;
        coverHeight: number | null;
      };
      _count: { works: number };
    },
    paidProductIds: Set<string>,
  ) {
    const { collection } = membership;

    if (
      !collection.coverUrl?.trim() ||
      !collection.coverAlt?.trim() ||
      !collection.coverWidth ||
      !collection.coverHeight
    ) {
      throw new ConflictException("Workshop collection cover is incomplete");
    }

    return {
      id: collection.id,
      slug: collection.slug,
      title: collection.title,
      source: membership.source,
      hasPaidOrder: paidProductIds.has(collection.productId),
      expectedColoringCount: collection.expectedColoringCount,
      workCount: membership._count.works,
      cover: {
        url: collection.coverUrl,
        alt: collection.coverAlt,
        width: collection.coverWidth,
        height: collection.coverHeight,
      },
      addedAt: membership.addedAt.toISOString(),
    };
  }

  private mapOfficialImage(
    collectionSlug: string,
    number: number,
    revision: {
      id: string;
      coloredAlt: string;
      coloredChecksum: string;
      width: number;
      height: number;
      cardChecksum: string | null;
      cardWidth: number | null;
      cardHeight: number | null;
    },
  ) {
    const version = revision.cardChecksum ?? revision.coloredChecksum;

    return {
      url: `${this.apiUrl()}/colorings/${encodeURIComponent(collectionSlug)}/${String(number).padStart(2, "0")}/assets/${revision.id}/card/content?v=${version}`,
      alt: revision.coloredAlt,
      width: revision.cardWidth ?? revision.width,
      height: revision.cardHeight ?? revision.height,
    };
  }

  private mapOfficialRevision(revision: {
    id: string;
    version: number;
    paletteLabel: string;
    paletteVersion: string;
    paletteColors: Array<{
      symbolPosition: number;
      markerColorId: string;
      colorNumber: number;
      pantone: string;
      hex: string;
      markerNumber: string;
    }>;
  }) {
    return {
      id: revision.id,
      version: revision.version,
      palette: {
        label: revision.paletteLabel,
        version: revision.paletteVersion,
        colors: revision.paletteColors.map((color) => ({
          ...color,
          symbol: this.symbol(color.symbolPosition),
        })),
      },
    };
  }

  private mapWork(
    work: Prisma.WorkshopWorkGetPayload<{ include: typeof workInclude }>,
  ) {
    return {
      id: work.id,
      publicId: work.publicId,
      attemptNumber: work.attemptNumber,
      isPublicationEnabled: work.isPublicationEnabled,
      isIndexable: work.isIndexable,
      publishedAt: work.publishedAt?.toISOString(),
      ...(work.currentRevision
        ? { currentRevision: this.mapRevision(work.currentRevision, true) }
        : {}),
      ...(work.publishedRevision
        ? { publishedRevision: this.mapRevision(work.publishedRevision, false) }
        : {}),
      createdAt: work.createdAt.toISOString(),
    };
  }

  private mapRevision(revision: StoredRevision, owner: boolean) {
    if (!revision.submittedAt) {
      throw new ConflictException(
        "Workshop revision submission timestamp is missing",
      );
    }

    if (revision.advertisingConsent && !revision.advertisingConsentAt) {
      throw new ConflictException(
        "Workshop advertising consent timestamp is missing",
      );
    }

    return {
      id: revision.id,
      sequence: revision.sequence,
      status: revision.status,
      moderationReason: revision.moderationEvents[0]?.reason ?? undefined,
      caption: revision.caption ?? undefined,
      advertisingConsent: revision.advertisingConsent ?? undefined,
      advertisingConsentAt: revision.advertisingConsentAt?.toISOString(),
      crop: {
        rotation: revision.cropRotation,
        zoom: revision.cropZoom,
        x: revision.cropX,
        y: revision.cropY,
      },
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
                id: mapping.officialMarkerColorId,
                colorNumber: mapping.officialColorNumber,
                pantone: mapping.officialPantone,
                hex: mapping.officialHex,
                markerNumber: mapping.officialMarkerNumber,
              },
            }
          : {}),
      })),
      assets: {
        normalized: owner
          ? this.ownerAssetUrl(revision.id, "normalized")
          : undefined,
        web: this.ownerAssetUrl(revision.id, "web"),
        thumb: this.ownerAssetUrl(revision.id, "thumb"),
      },
      suspectedOfficialCopy: revision.suspectedOfficialCopy,
      submittedAt: revision.submittedAt.toISOString(),
      moderatedAt: revision.moderatedAt?.toISOString(),
      createdAt: revision.createdAt.toISOString(),
    };
  }

  private async getPaidProductIds(userId: string) {
    const items = await this.prisma.orderItem.findMany({
      where: {
        order: { is: { userId, status: "PAID", paymentStatus: "PAID" } },
      },
      select: { productId: true },
      take: 10_000,
    });
    return new Set(items.map(({ productId }) => productId));
  }

  private async syncPurchasedCollections(
    workshopId: string,
    paidProductIds: Set<string>,
  ) {
    if (paidProductIds.size === 0) {
      return;
    }

    const collections = await this.prisma.coloringCollection.findMany({
      where: {
        productId: { in: [...paidProductIds] },
        status: ColoringCollectionStatus.PUBLISHED,
      },
      select: { id: true },
      take: 500,
    });

    if (collections.length === 0) {
      return;
    }

    await this.prisma.workshopCollection.createMany({
      data: collections.map((collection) => ({
        workshopId,
        collectionId: collection.id,
        source: WorkshopCollectionSource.PURCHASE,
      })),
      skipDuplicates: true,
    });
  }

  private async getOrCreateWorkshop(userId: string) {
    const existing = await this.prisma.workshop.findUnique({
      where: { ownerId: userId },
    });

    if (existing) {
      return existing;
    }

    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        return await this.prisma.workshop.create({
          data: {
            id: this.randomId(),
            ownerId: userId,
            handle: randomBytes(10).toString("hex"),
          },
        });
      } catch (error) {
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== "P2002"
        ) {
          throw error;
        }

        const concurrent = await this.prisma.workshop.findUnique({
          where: { ownerId: userId },
        });
        if (concurrent) {
          return concurrent;
        }
      }
    }

    throw new ConflictException("Could not allocate workshop handle");
  }

  private async readAsset(
    revision: WorkshopWorkRevision,
    variant: "normalized" | "web" | "thumb",
  ) {
    return this.storage.read(revision[`${variant}StorageKey`], {
      checksum: revision[`${variant}Checksum`],
      width: revision[`${variant}Width`],
      height: revision[`${variant}Height`],
    });
  }

  private parseVariant(value: string) {
    if (value !== "normalized" && value !== "web" && value !== "thumb") {
      throw this.notFound();
    }

    return value;
  }

  private ownerAssetUrl(revisionId: string, variant: string) {
    return `${this.apiUrl()}/workshops/me/revisions/${revisionId}/assets/${variant}`;
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

  private randomId() {
    return randomBytes(16).toString("hex");
  }

  private randomPublicId() {
    return randomBytes(12).toString("hex");
  }

  private notFound() {
    return new NotFoundException("Workshop resource not found");
  }
}
