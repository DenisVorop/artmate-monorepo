import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";

import type { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  achievementIntegerMax,
  type AchievementDraftDTO,
  type CreateAchievementDraftDTO,
  type UpdateAchievementDraftDTO,
} from "./achievement-drafts.dto";

type Definition = Prisma.LoyaltyAchievementDefinitionGetPayload<{
  include: { currentRevision: true };
}>;

@Injectable()
export class LoyaltyAchievementDraftsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<AchievementDraftDTO[]> {
    const definitions = await this.prisma.loyaltyAchievementDefinition.findMany(
      {
        include: { currentRevision: true },
        orderBy: [{ currentRevision: { sortOrder: "asc" } }, { id: "asc" }],
      },
    );
    return definitions.map(toDTO);
  }

  async create(userId: string, input: CreateAchievementDraftDTO) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR KEY SHARE`;
      const id = randomUUID();
      await tx.loyaltyAchievementDefinition.create({
        data: { id, currentVersion: 1 },
      });
      await tx.loyaltyAchievementRevision.create({
        data: {
          ...revisionInput(input),
          definitionId: id,
          version: 1,
          createdById: userId,
        },
      });
      return toDTO(await this.read(tx, id));
    });
  }

  async update(id: string, userId: string, input: UpdateAchievementDraftDTO) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR KEY SHARE`;
      const definition = await this.lock(tx, id, input.expectedVersion);
      if (definition.archivedAt) {
        throw new ConflictException("Archived achievements cannot be edited");
      }
      if (definition.currentVersion === achievementIntegerMax) {
        throw new ConflictException("Achievement version limit reached");
      }
      const version = definition.currentVersion + 1;
      await tx.loyaltyAchievementRevision.create({
        data: {
          ...revisionInput(input),
          definitionId: id,
          version,
          createdById: userId,
        },
      });
      await tx.loyaltyAchievementDefinition.update({
        where: { id },
        data: { currentVersion: version },
      });
      return toDTO(await this.read(tx, id));
    });
  }

  async archive(id: string, expectedVersion: number) {
    return this.prisma.$transaction(async (tx) => {
      const definition = await this.lock(tx, id, expectedVersion);
      if (!definition.archivedAt) {
        await tx.loyaltyAchievementDefinition.update({
          where: { id },
          data: { archivedAt: new Date() },
        });
      }
      return toDTO(await this.read(tx, id));
    });
  }

  async activate(id: string, userId: string, expectedVersion: number) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR KEY SHARE`;
      await this.lock(tx, id, expectedVersion);
      const definition = await this.read(tx, id);
      if (definition.archivedAt) {
        throw new ConflictException(
          "Archived achievements cannot be activated",
        );
      }
      if (
        ![
          "published_coloring_count",
          "distinct_collection_count",
          "completed_collection_count",
          "completed_order_count",
        ].includes(definition.currentRevision.conditionKind)
      ) {
        throw new ConflictException(
          "This achievement condition is not available for activation yet",
        );
      }
      if (definition.activeVersion !== definition.currentVersion) {
        await tx.loyaltyAchievementDefinition.update({
          where: { id },
          data: {
            activeVersion: definition.currentVersion,
            activatedAt: new Date(),
            activatedById: userId,
          },
        });
      }
      return toDTO(await this.read(tx, id));
    });
  }

  private async lock(
    tx: Prisma.TransactionClient,
    id: string,
    expectedVersion: number,
  ) {
    const rows = await tx.$queryRaw<
      { currentVersion: number; archivedAt: Date | null }[]
    >`
      SELECT current_version AS "currentVersion", archived_at AS "archivedAt"
      FROM loyalty_achievement_definitions WHERE id = ${id}::uuid FOR UPDATE
    `;
    const definition = rows[0];
    if (!definition) {
      throw new NotFoundException("Achievement not found");
    }
    if (definition.currentVersion !== expectedVersion) {
      throw new ConflictException(
        "Achievement version conflict; reload the draft",
      );
    }
    return definition;
  }

  private read(tx: Prisma.TransactionClient, id: string) {
    return tx.loyaltyAchievementDefinition.findUniqueOrThrow({
      where: { id },
      include: { currentRevision: true },
    });
  }
}

function revisionInput(input: CreateAchievementDraftDTO) {
  return {
    title: input.title.trim(),
    description: input.description.trim(),
    imageUrl: input.imageUrl ?? null,
    conditionKind: input.conditionKind,
    target: input.target,
    rewardPoints: input.rewardPoints,
    sortOrder: input.sortOrder,
  };
}

function toDTO(definition: Definition): AchievementDraftDTO {
  const revision = definition.currentRevision;
  return {
    id: definition.id,
    version: definition.currentVersion,
    status: definition.archivedAt
      ? "archived"
      : definition.activeVersion
        ? "active"
        : "draft",
    activeVersion: definition.activeVersion,
    title: revision.title,
    description: revision.description,
    imageUrl: revision.imageUrl,
    conditionKind: revision.conditionKind,
    target: revision.target,
    rewardPoints: revision.rewardPoints,
    sortOrder: revision.sortOrder,
    createdAt: definition.createdAt.toISOString(),
    updatedAt: definition.updatedAt.toISOString(),
  };
}
