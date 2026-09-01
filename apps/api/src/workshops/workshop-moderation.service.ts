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
import { WorkshopStorageService } from "./workshop-storage.service";

const moderationWorkInclude = {
  workshop: { include: { owner: { select: { id: true, name: true, image: true } } } },
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
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "workshop_work_revisions" WHERE "id" = ${revisionId} FOR UPDATE`,
      );
      const revision = await tx.workshopWorkRevision.findUnique({
        where: { id: revisionId },
        include: { work: { include: { workshop: true } } },
      });

      if (!revision) {
        throw this.notFound();
      }

      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "workshop_works" WHERE "id" = ${revision.workId} FOR UPDATE`,
      );
      const lockedWork = await tx.workshopWork.findUnique({
        where: { id: revision.workId },
        include: { workshop: true },
      });

      if (!lockedWork || lockedWork.deletedAt) {
        throw this.notFound();
      }

      const now = new Date();
      let status: WorkshopRevisionStatus;
      let decision: WorkshopModerationDecision;

      if (input.decision === "APPROVE") {
        if (revision.status !== WorkshopRevisionStatus.PENDING) {
          throw new ConflictException("Only the exact pending revision can be approved");
        }

        if (lockedWork.currentRevisionId !== revision.id) {
          throw new ConflictException("Only the current pending revision can be approved");
        }

        status = WorkshopRevisionStatus.APPROVED;
        decision = WorkshopModerationDecision.APPROVED;
        await tx.workshopWork.update({
          where: { id: revision.workId },
          data: {
            publishedRevisionId: revision.id,
            publishedAt:
              lockedWork.isPublicationEnabled && lockedWork.workshop.isPublic
                ? now
                : null,
          },
        });
      } else if (input.decision === "REQUEST_CHANGES") {
        if (revision.status !== WorkshopRevisionStatus.PENDING) {
          throw new ConflictException("Only a pending revision can request changes");
        }
        if (lockedWork.currentRevisionId !== revision.id) {
          throw new ConflictException("Only the current pending revision can request changes");
        }

        status = WorkshopRevisionStatus.CHANGES_REQUESTED;
        decision = WorkshopModerationDecision.CHANGES_REQUESTED;
      } else {
        if (
          revision.status !== WorkshopRevisionStatus.APPROVED ||
          lockedWork.publishedRevisionId !== revision.id
        ) {
          throw new ConflictException("Only the currently published revision can be hidden");
        }

        status = WorkshopRevisionStatus.HIDDEN;
        decision = WorkshopModerationDecision.HIDDEN;

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
        where: { id: revision.id, status: revision.status },
        data: { status, moderatedAt: now },
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
          decision,
          reason,
        },
      });
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
      submittedAt: revision.submittedAt?.toISOString(),
      createdAt: revision.createdAt.toISOString(),
    };
  }

  private mapDetail(revision: ModerationRevision) {
    const base = this.mapList(revision);

    return {
      ...base,
      caption: revision.caption ?? undefined,
      advertisingConsent: revision.advertisingConsent,
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
    const status = WorkshopRevisionStatus[value as keyof typeof WorkshopRevisionStatus];

    if (!status) {
      throw new BadRequestException("Moderation status is invalid");
    }

    return status;
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
    return position <= 9 ? String(position) : String.fromCharCode(55 + position);
  }

  private apiUrl() {
    return (process.env.API_PUBLIC_URL ?? "http://localhost:3002").replace(/\/+$/, "");
  }

  private notFound() {
    return new NotFoundException("Workshop moderation resource not found");
  }
}
