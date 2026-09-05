import { randomBytes } from "node:crypto";

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import {
  Prisma,
  WorkshopModerationDecision,
  WorkshopRevisionStatus,
} from "../generated/prisma/client";
import { ColoringStorageService } from "../colorings/coloring-storage.service";
import { PrismaService } from "../prisma/prisma.service";
import type { WorkshopModerationDecisionDTO } from "./dto";
import { WorkshopAssetDeletionQueueService } from "./workshop-asset-deletion-queue.service";
import { WorkshopStorageService } from "./workshop-storage.service";

const moderationWorkInclude = {
  workshop: {
    include: { owner: { select: { id: true, name: true, image: true } } },
  },
  coloring: { include: { collection: true } },
} satisfies Prisma.WorkshopWorkInclude;

const listInclude = {
  work: {
    include: moderationWorkInclude,
  },
} satisfies Prisma.WorkshopWorkRevisionInclude;

const detailInclude = {
  work: {
    include: {
      ...moderationWorkInclude,
      moderationEvents: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        include: { actor: { select: { id: true, name: true } } },
      },
    },
  },
  officialRevision: {
    include: { paletteColors: { orderBy: { symbolPosition: "asc" } } },
  },
  materials: { orderBy: { position: "asc" } },
  symbolMappings: { orderBy: { symbol: "asc" } },
} satisfies Prisma.WorkshopWorkRevisionInclude;

type ModerationListRevision = Prisma.WorkshopWorkRevisionGetPayload<{
  include: typeof listInclude;
}>;

type ModerationRevision = Prisma.WorkshopWorkRevisionGetPayload<{
  include: typeof detailInclude;
}>;

@Injectable()
export class WorkshopModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: WorkshopStorageService,
    private readonly coloringStorage: ColoringStorageService,
    private readonly deletionQueue: WorkshopAssetDeletionQueueService,
  ) {}

  async list(status?: string) {
    const parsedStatus = status ? this.parseStatus(status) : undefined;
    const revisions = await this.prisma.workshopWorkRevision.findMany({
      where: {
        ...(parsedStatus ? { status: parsedStatus } : {}),
        work: { is: { deletedAt: null } },
      },
      include: listInclude,
      orderBy: [{ submittedAt: "asc" }, { createdAt: "asc" }],
      take: 500,
    });

    return revisions.map((revision) => this.mapList(revision));
  }

  async get(revisionId: string) {
    return this.mapDetail(await this.find(revisionId));
  }

  async decide(
    revisionId: string,
    adminId: string,
    input: WorkshopModerationDecisionDTO,
  ) {
    const reason = input.reason?.trim() || null;

    if (input.decision !== "APPROVE" && !reason) {
      throw new BadRequestException("Moderation reason is required");
    }

    await this.prisma.$transaction(async (tx) => {
      const seed = await tx.workshopWorkRevision.findUnique({
        where: { id: revisionId },
        select: { workId: true },
      });

      if (!seed) {
        throw this.notFound();
      }

      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "workshop_works" WHERE "id" = ${seed.workId} FOR UPDATE`,
      );
      const lockedWork = await tx.workshopWork.findUnique({
        where: { id: seed.workId },
        include: { workshop: true },
      });

      if (!lockedWork || lockedWork.deletedAt) {
        throw this.notFound();
      }

      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "workshop_work_revisions" WHERE "work_id" = ${seed.workId} ORDER BY "id" FOR UPDATE`,
      );
      const revisions = await tx.workshopWorkRevision.findMany({
        where: { workId: seed.workId },
      });
      const revision = revisions.find(({ id }) => id === revisionId);

      if (!revision) {
        throw this.notFound();
      }

      const now = new Date();

      if (input.decision === "APPROVE") {
        if (revision.status !== WorkshopRevisionStatus.PENDING) {
          throw new ConflictException(
            "Only the exact pending revision can be approved",
          );
        }

        if (lockedWork.currentRevisionId !== revision.id) {
          throw new ConflictException(
            "Only the current pending revision can be approved",
          );
        }

        const hasActivePublication =
          lockedWork.isPublicationEnabled &&
          lockedWork.publishedRevisionId !== null &&
          lockedWork.publishedAt !== null;
        const shouldPublishRevision =
          revision.publicationConsent && lockedWork.isPublicationEnabled;
        const shouldKeepActivePublication =
          !shouldPublishRevision && hasActivePublication;

        if (!shouldKeepActivePublication) {
          await tx.workshopWork.update({
            where: { id: revision.workId },
            data: {
              publishedRevisionId: revision.id,
              isPublicationEnabled: shouldPublishRevision,
              isIndexable: shouldPublishRevision
                ? lockedWork.isIndexable
                : false,
              publishedAt:
                shouldPublishRevision && lockedWork.workshop.isPublic
                  ? now
                  : null,
            },
          });
        }
        const changed = await tx.workshopWorkRevision.updateMany({
          where: { id: revision.id, status: revision.status },
          data: { status: WorkshopRevisionStatus.APPROVED, moderatedAt: now },
        });

        if (changed.count !== 1) {
          throw new ConflictException("Revision changed concurrently");
        }

        await tx.workshopModerationEvent.create({
          data: {
            id: randomBytes(16).toString("hex"),
            workId: revision.workId,
            revisionId: revision.id,
            actorId: adminId,
            decision: WorkshopModerationDecision.APPROVED,
            reason,
          },
        });
        return;
      } else if (input.decision === "REQUEST_CHANGES") {
        if (revision.status !== WorkshopRevisionStatus.PENDING) {
          throw new ConflictException(
            "Only a pending revision can request changes",
          );
        }
        if (lockedWork.currentRevisionId !== revision.id) {
          throw new ConflictException(
            "Only the current pending revision can request changes",
          );
        }

        const changed = await tx.workshopWorkRevision.updateMany({
          where: { id: revision.id, status: revision.status },
          data: {
            status: WorkshopRevisionStatus.CHANGES_REQUESTED,
            moderatedAt: now,
          },
        });

        if (changed.count !== 1) {
          throw new ConflictException("Revision changed concurrently");
        }

        await tx.workshopModerationEvent.create({
          data: {
            id: randomBytes(16).toString("hex"),
            workId: revision.workId,
            revisionId: revision.id,
            actorId: adminId,
            decision: WorkshopModerationDecision.CHANGES_REQUESTED,
            reason,
          },
        });
        return;
      }

      const isCurrentPolicyRejection =
        lockedWork.currentRevisionId === revision.id &&
        (revision.status === WorkshopRevisionStatus.PENDING ||
          revision.status === WorkshopRevisionStatus.CHANGES_REQUESTED);
      const isPublishedPolicyRemoval =
        revision.status === WorkshopRevisionStatus.APPROVED &&
        lockedWork.publishedRevisionId === revision.id;

      if (!isCurrentPolicyRejection && !isPublishedPolicyRemoval) {
        throw new ConflictException(
          "Only the current review candidate or published revision can be hidden",
        );
      }

      const closure = this.assetClosure(revision, revisions);
      const closureIds = closure.map(({ id }) => id);
      const affected = closure.filter(
        ({ status }) => status !== WorkshopRevisionStatus.HIDDEN,
      );
      const affectedIds = affected.map(({ id }) => id);

      if (
        lockedWork.publishedRevisionId &&
        closureIds.includes(lockedWork.publishedRevisionId)
      ) {
        await tx.workshopWork.update({
          where: { id: revision.workId },
          data: {
            publishedRevisionId: null,
            isPublicationEnabled: false,
            isIndexable: false,
            publishedAt: null,
          },
        });
      }

      const changed = await tx.workshopWorkRevision.updateMany({
        where: {
          id: { in: affectedIds },
          status: { not: WorkshopRevisionStatus.HIDDEN },
        },
        data: { status: WorkshopRevisionStatus.HIDDEN, moderatedAt: now },
      });

      if (changed.count !== affected.length) {
        throw new ConflictException("Revision changed concurrently");
      }

      await tx.workshopModerationEvent.createMany({
        data: affected.map((item) => ({
          id: randomBytes(16).toString("hex"),
          workId: item.workId,
          revisionId: item.id,
          actorId: adminId,
          decision: WorkshopModerationDecision.HIDDEN,
          reason,
        })),
      });
      await this.deletionQueue.enqueue(
        tx,
        [
          ...new Set(
            closure.flatMap((item) => [
              item.normalizedStorageKey,
              item.webStorageKey,
              item.thumbStorageKey,
            ]),
          ),
        ],
      );
    });

    return this.get(revisionId);
  }

  async getAsset(revisionId: string, variant: string) {
    const parsed = this.parseVariant(variant);
    const revision = await this.prisma.workshopWorkRevision.findFirst({
      where: { id: revisionId, work: { is: { deletedAt: null } } },
      include: { officialRevision: true },
    });

    if (!revision) {
      throw this.notFound();
    }

    if (parsed === "official") {
      return this.coloringStorage.readProtected(
        revision.officialRevision.coloredStorageKey,
        {
          checksum: revision.officialRevision.coloredChecksum,
          width: revision.officialRevision.width,
          height: revision.officialRevision.height,
        },
      );
    }

    return this.storage.read(revision[`${parsed}StorageKey`], {
      checksum: revision[`${parsed}Checksum`],
      width: revision[`${parsed}Width`],
      height: revision[`${parsed}Height`],
    });
  }

  private async find(revisionId: string) {
    const revision = await this.prisma.workshopWorkRevision.findFirst({
      where: { id: revisionId, work: { is: { deletedAt: null } } },
      include: detailInclude,
    });

    if (!revision) {
      throw this.notFound();
    }

    return revision;
  }

  private mapList(revision: ModerationListRevision) {
    if (!revision.submittedAt) {
      throw new ConflictException(
        "Workshop revision submission timestamp is missing",
      );
    }

    return {
      revisionId: revision.id,
      workId: revision.workId,
      status: revision.status,
      isPublishedRevision: revision.work.publishedRevisionId === revision.id,
      author: {
        id: revision.work.workshop.owner.id,
        name: revision.work.workshop.owner.name?.trim() || "Автор",
        image: revision.work.workshop.owner.image?.trim() || undefined,
      },
      workshopHandle: revision.work.workshop.handle,
      collection: {
        id: revision.work.coloring.collection.id,
        slug: revision.work.coloring.collection.slug,
        title: revision.work.coloring.collection.title,
      },
      coloring: {
        id: revision.work.coloring.id,
        number: revision.work.coloring.number,
        title: revision.work.coloring.title,
      },
      suspectedOfficialCopy: revision.suspectedOfficialCopy,
      submittedAt: revision.submittedAt.toISOString(),
      createdAt: revision.createdAt.toISOString(),
    };
  }

  private mapDetail(revision: ModerationRevision) {
    const base = this.mapList(revision);

    if (revision.advertisingConsent && !revision.advertisingConsentAt) {
      throw new ConflictException(
        "Workshop advertising consent timestamp is missing",
      );
    }

    if (
      revision.publicationConsent !== Boolean(revision.publicationConsentAt) ||
      (revision.publicationConsentAt &&
        revision.publicationConsentAt.getTime() !==
          revision.submittedAt!.getTime())
    ) {
      throw new ConflictException(
        "Workshop publication consent timestamp is invalid",
      );
    }

    return {
      ...base,
      caption: revision.caption ?? undefined,
      advertisingConsent: revision.advertisingConsent,
      advertisingConsentAt: revision.advertisingConsentAt?.toISOString(),
      publicationConsent: revision.publicationConsent,
      publicationConsentAt: revision.publicationConsentAt?.toISOString(),
      officialComparison: {
        revisionId: revision.officialRevisionId,
        version: revision.officialRevision.version,
        coloredUrl: `${this.apiUrl()}/admin/workshop-moderation/${revision.id}/assets/official`,
        palette: {
          label: revision.officialRevision.paletteLabel,
          version: revision.officialRevision.paletteVersion,
          colors: revision.officialRevision.paletteColors.map((color) => ({
            id: color.markerColorId,
            symbolPosition: color.symbolPosition,
            symbol: this.symbol(color.symbolPosition),
            colorNumber: color.colorNumber,
            pantone: color.pantone,
            hex: color.hex,
            markerNumber: color.markerNumber,
          })),
        },
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
        normalized: `${this.apiUrl()}/admin/workshop-moderation/${revision.id}/assets/normalized`,
        web: `${this.apiUrl()}/admin/workshop-moderation/${revision.id}/assets/web`,
        thumb: `${this.apiUrl()}/admin/workshop-moderation/${revision.id}/assets/thumb`,
      },
      decisionHistory: [...revision.work.moderationEvents]
        .sort(
          (left, right) =>
            left.createdAt.getTime() - right.createdAt.getTime() ||
            left.id.localeCompare(right.id),
        )
        .map((event) => ({
          id: event.id,
          revisionId: event.revisionId,
          decision: event.decision,
          reason: event.reason ?? undefined,
          actor: {
            id: event.actor.id,
            name: event.actor.name?.trim() || "Пользователь",
          },
          createdAt: event.createdAt.toISOString(),
        })),
    };
  }

  private parseStatus(value: string) {
    const status =
      WorkshopRevisionStatus[value as keyof typeof WorkshopRevisionStatus];

    if (!status) {
      throw new BadRequestException("Moderation status is invalid");
    }

    return status;
  }

  private assetClosure<
    T extends {
      id: string;
      normalizedStorageKey: string;
      webStorageKey: string;
      thumbStorageKey: string;
    },
  >(seed: T, revisions: T[]) {
    const revisionIds = new Set([seed.id]);
    const storageKeys = new Set(this.assetKeys(seed));
    let foundSharedRevision = true;

    while (foundSharedRevision) {
      foundSharedRevision = false;

      for (const revision of revisions) {
        if (revisionIds.has(revision.id)) {
          continue;
        }

        const revisionKeys = this.assetKeys(revision);

        if (!revisionKeys.some((key) => storageKeys.has(key))) {
          continue;
        }

        revisionIds.add(revision.id);
        revisionKeys.forEach((key) => storageKeys.add(key));
        foundSharedRevision = true;
      }
    }

    return revisions.filter(({ id }) => revisionIds.has(id));
  }

  private assetKeys(revision: {
    normalizedStorageKey: string;
    webStorageKey: string;
    thumbStorageKey: string;
  }) {
    return [
      revision.normalizedStorageKey,
      revision.webStorageKey,
      revision.thumbStorageKey,
    ];
  }

  private parseVariant(value: string) {
    if (
      value !== "normalized" &&
      value !== "web" &&
      value !== "thumb" &&
      value !== "official"
    ) {
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
    return new NotFoundException("Workshop moderation resource not found");
  }
}
