import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, type Contest } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  mapPromoPrizeTerms,
  promoPrizeTemplateSelect,
} from "../promocodes/contracts/prize-template.publication";
import type {
  CreateContestRequestDTO,
  UpdateContestRequestDTO,
} from "./dto/contest-request.dto";
import type { ContestAppearance, ContestStage } from "./contests.types";
import {
  contestDrawInclude,
  mapContestDraw,
  type ContestDrawRecord,
} from "./contest-draw-read-model";
import {
  contestEntryInclude,
  mapContestWork,
  publicContestEntryWhere,
} from "./contest-entry-read-model";

import {
  contestPrizes,
  normalizePrize,
  prizePresentation,
  prizeProductGroups,
  type PrizeDefinition,
  type PrizeDefinitionInput,
} from "./prize-definitions";
import { saveContestLegalDocument } from "./legal/contest-legal-documents";
import { legalReadiness } from "./legal/contest-conditions";
import { throwContestConsentError } from "./legal/contest-consent-errors";
import { conditionsHref } from "./legal/contest-legal.constants";

@Injectable()
export class ContestsService {
  constructor(private readonly prisma: PrismaService) {}

  async listAdmin() {
    return Promise.all(
      (
        await this.prisma.contest.findMany({
          include: { draw: { include: contestDrawInclude } },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        })
      ).map((contest) => this.mapAdmin(contest)),
    );
  }
  async getAdmin(id: string) {
    return this.mapAdmin(await this.find(id));
  }
  async listPublic() {
    return (
      await this.prisma.contest.findMany({
        where: { published: true },
        include: { draw: { include: contestDrawInclude } },
        orderBy: [{ opensAt: "desc" }, { id: "desc" }],
      })
    ).map((contest) => this.map(contest));
  }
  async getPublic(slug: string) {
    const contest = await this.prisma.contest.findFirst({
      where: { slug, published: true },
      include: { draw: { include: contestDrawInclude } },
    });
    if (!contest) throw new NotFoundException("Конкурс не найден");
    const entries = await this.prisma.contestEntry.findMany({
      where: { ...publicContestEntryWhere(), contestId: contest.id },
      include: contestEntryInclude,
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      take: 500,
    });
    const pendingEntries = await this.prisma.contestEntry.count({
      where: {
        contestId: contest.id,
        status: { in: ["PENDING", "CHANGES_REQUESTED"] },
      },
    });
    const pendingCount =
      pendingEntries +
      (await this.prisma.contestEntrySubmission.count({
        where: { contestId: contest.id, status: "PENDING" },
      }));
    return {
      ...this.map(contest),
      works: entries.map(mapContestWork),
      resultsPendingModeration:
        !contest.draw &&
        Date.now() >= contest.drawAt.getTime() &&
        pendingCount > 0,
    };
  }
  async create(input: CreateContestRequestDTO) {
    const data = this.data(input);
    try {
      const saved = await this.prisma.$transaction(
        async (tx) => {
          const rewards = await this.preparePrizes(data, tx);
          const contest = await tx.contest.create({
            data: {
              ...data,
              ...rewards,
              publishedAt: input.published ? new Date() : null,
            },
          });
          await saveContestLegalDocument(tx, contest);
          return this.map(
            await tx.contest.findUniqueOrThrow({ where: { id: contest.id } }),
          );
        },
        { timeout: 20_000 },
      );
      return saved;
    } catch (error) {
      this.rethrow(error);
    }
  }
  async update(id: string, input: UpdateContestRequestDTO) {
    const data = this.data(input);
    try {
      const saved = await this.prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM contests WHERE id = ${id} FOR UPDATE`;
          const current = await tx.contest.findUnique({ where: { id } });
          if (!current) throw new NotFoundException("Конкурс не найден");
          if (current.publishedAt && current.slug !== input.slug)
            throw new ConflictException(
              "Адрес опубликованного конкурса менять нельзя",
            );
          const locked = Boolean(
            current.publishedAt ||
            (await tx.contestEntry.count({ where: { contestId: id } })) ||
            (await tx.contestDraw.findUnique({ where: { contestId: id } })),
          );
          if (locked) {
            const frozen = [
              "title",
              "slug",
              "manualCriteria",
              "manualTieBreak",
              "manualEvaluator",
              "task",
              "rules",
              "prize",
              "prizeDetail",
              "winnersCount",
              "selectionMode",
              "opensAt",
              "closesAt",
              "drawAt",
              "prizePromoCodeId",
              "prizeMode",
              "participationPromoCodeId",
              "prizeMarkerQuantity",
              "prizeMarkerIds",
            ] as const;
            if (
              JSON.stringify(contestPrizes(current).map(normalizePrize)) !==
                JSON.stringify(this.inputPrizes(data)) ||
              current.prizeAlbumQuantity !== data.prizeAlbumQuantity ||
              JSON.stringify([...current.prizeAlbumIds].sort()) !==
                JSON.stringify([...data.prizeAlbumIds].sort())
            )
              throw new ConflictException(
                "После публикации нельзя менять состав призов: он уже зафиксирован",
              );
            if (
              frozen.some(
                (key) =>
                  JSON.stringify(current[key]) !== JSON.stringify(data[key]),
              )
            )
              throw new ConflictException(
                "После публикации нельзя менять название, задание, условия, сроки, призы и выбор победителей",
              );
          }
          const rewards = locked
            ? {
                prizePlaces: current.prizePlaces as Prisma.InputJsonValue,
                prizePromoTerms: current.prizePromoTerms ?? Prisma.DbNull,
                participationPromoTerms:
                  current.participationPromoTerms ?? Prisma.DbNull,
              }
            : await this.preparePrizes(data, tx);
          const result = await tx.contest.updateMany({
            where: { id, version: input.version },
            data: {
              ...data,
              ...rewards,
              publishedAt:
                current.publishedAt ?? (input.published ? new Date() : null),
              version: { increment: 1 },
            },
          });
          if (!result.count)
            throw new ConflictException(
              "Конкурс уже изменён. Обновите страницу перед сохранением",
            );
          const updated = await tx.contest.findUniqueOrThrow({ where: { id } });
          if (!current.publishedAt || !current.legalDocumentId) {
            const documentId = await saveContestLegalDocument(tx, updated);
            if (!documentId)
              await tx.contest.update({
                where: { id },
                data: { legalDocumentId: null },
              });
          }
          const saved = await tx.contest.findUniqueOrThrow({
            where: { id },
            include: { draw: { include: contestDrawInclude } },
          });
          return {
            ...this.map(saved),
            entriesCount: await tx.contestEntry.count({
              where: { contestId: id },
            }),
            pendingCount: await tx.contestEntry.count({
              where: {
                contestId: id,
                status: { in: ["PENDING", "CHANGES_REQUESTED"] },
              },
            }),
          };
        },
        { timeout: 20_000 },
      );
      return saved;
    } catch (error) {
      this.rethrow(error);
    }
  }
  private async mapAdmin(
    contest: Contest & { draw?: ContestDrawRecord | null },
  ) {
    const [entriesCount, pendingCount] = await Promise.all([
      this.prisma.contestEntry.count({ where: { contestId: contest.id } }),
      this.prisma.contestEntry.count({
        where: {
          contestId: contest.id,
          status: { in: ["PENDING", "CHANGES_REQUESTED"] },
        },
      }),
    ]);
    return { ...this.map(contest), entriesCount, pendingCount };
  }
  private async find(id: string) {
    const contest = await this.prisma.contest.findUnique({
      where: { id },
      include: { draw: { include: contestDrawInclude } },
    });
    if (!contest) throw new NotFoundException("Конкурс не найден");
    return contest;
  }
  private data(input: CreateContestRequestDTO) {
    const opensAt = new Date(input.opensAt),
      closesAt = new Date(input.closesAt),
      drawAt = new Date(input.drawAt);
    if (!(opensAt < closesAt && closesAt < drawAt))
      throw new BadRequestException(
        "Приём должен закончиться после начала и до выбора победителей",
      );
    return {
      slug: input.slug,
      title: input.title,
      manualCriteria: input.manualCriteria ?? "",
      manualTieBreak: input.manualTieBreak ?? "",
      manualEvaluator: input.manualEvaluator ?? "",
      description: input.description,
      task: input.task,
      rules: input.rules,
      appearance: input.appearance,
      prize:
        input.prizeMode === "PLACES"
          ? (input.prizePlaces?.[0]?.prize ?? input.prize)
          : input.prize,
      prizeDetail:
        input.prizeMode === "PLACES" ? "Призы по местам" : input.prizeDetail,
      prizeMode: input.prizeMode ?? "EQUAL",
      prizePlaces: (input.prizePlaces ?? []).map(normalizePrize),
      prizeMarkerQuantity:
        input.prizeMode === "PLACES"
          ? null
          : (input.prizeMarkerQuantity ?? null),
      prizeMarkerIds:
        input.prizeMode === "PLACES"
          ? []
          : [...(input.prizeMarkerIds ?? [])].sort(),
      participationPromoCodeId: input.participationPromoCodeId ?? null,
      prizeAlbumQuantity:
        input.prizeMode === "PLACES"
          ? null
          : (input.prizeAlbumQuantity ?? null),
      prizeAlbumIds:
        input.prizeMode === "PLACES"
          ? []
          : [...(input.prizeAlbumIds ?? [])].sort(),
      prizePromoCodeId:
        input.prizeMode === "PLACES" ? null : (input.prizePromoCodeId ?? null),
      winnersCount: input.winnersCount,
      selectionMode: input.selectionMode,
      opensAt,
      closesAt,
      drawAt,
      published: input.published,
    };
  }
  private inputPrizes(
    data: ReturnType<ContestsService["data"]>,
  ): PrizeDefinitionInput[] {
    return data.prizeMode === "PLACES"
      ? data.prizePlaces
      : [normalizePrize(data)];
  }
  private async preparePrizes(
    data: ReturnType<ContestsService["data"]>,
    db: Prisma.TransactionClient,
  ) {
    const definitions = this.inputPrizes(data);
    if (
      !definitions.length ||
      (data.prizeMode === "PLACES" && definitions.length !== data.winnersCount)
    )
      throw new BadRequestException(
        "Количество мест должно совпадать с числом победителей",
      );
    if (data.prizeMode === "EQUAL" && data.prizePlaces.length)
      throw new BadRequestException("Уберите места для одинаковых призов");
    const frozen: PrizeDefinition[] = [];
    for (const definition of definitions) {
      const groups = prizeProductGroups(definition);
      for (const [quantity, ids] of [
        [definition.prizeAlbumQuantity, definition.prizeAlbumIds],
        [definition.prizeMarkerQuantity, definition.prizeMarkerIds],
      ] as const)
        if (quantity === null && ids.length)
          throw new BadRequestException("Укажите количество призовых товаров");
      const ids = groups.flatMap((group) => group.productIds);
      if (
        new Set(ids).size !== ids.length ||
        groups.some((group) => group.productIds.length < group.quantity)
      )
        throw new BadRequestException(
          "Добавьте достаточно разных товаров для каждой части приза",
        );
      for (const group of groups) {
        const count = await db.product.count({
          where: {
            id: { in: group.productIds },
            status: "PUBLISHED",
            isOzonDeliveryAvailable: true,
            images: { some: { url: { not: "" } } },
            ...(group.kind === "markers"
              ? { category: { is: { slug: "markery" } } }
              : {
                  OR: [
                    { categoryId: null },
                    { category: { is: { slug: { not: "markery" } } } },
                  ],
                }),
          },
        });
        if (count !== group.productIds.length)
          throw new BadRequestException(
            "Выберите опубликованные товары нужной категории с доставкой Ozon",
          );
      }
      const terms = await this.promoPrizeTerms(
        definition.prizePromoCodeId,
        data.drawAt,
        db,
      );
      frozen.push({ ...definition, prizePromoTerms: terms });
    }
    const participation = await this.promoPrizeTerms(
      data.participationPromoCodeId,
      data.drawAt,
      db,
    );
    return {
      prizePlaces: (data.prizeMode === "PLACES"
        ? frozen
        : []) as unknown as Prisma.InputJsonValue,
      prizePromoTerms:
        data.prizeMode === "PLACES"
          ? Prisma.DbNull
          : ((frozen[0]!.prizePromoTerms as unknown as Prisma.InputJsonValue) ??
            Prisma.DbNull),
      participationPromoTerms:
        (participation as unknown as Prisma.InputJsonValue) ?? Prisma.DbNull,
    };
  }
  private async promoPrizeTerms(
    id: string | null,
    drawAt: Date,
    db: Pick<Prisma.TransactionClient, "promoCode"> = this.prisma,
  ) {
    if (!id) return null;
    const promo = await db.promoCode.findUnique({
      where: { id },
      select: promoPrizeTemplateSelect,
    });
    if (!promo || promo.kind !== "STANDARD" || !promo.isActive)
      throw new BadRequestException("Выберите активный обычный промокод");
    if (promo.endsAt && promo.endsAt <= drawAt)
      throw new BadRequestException(
        "Промокод должен действовать после подведения итогов",
      );
    return mapPromoPrizeTerms(promo);
  }
  private map(contest: Contest & { draw?: ContestDrawRecord | null }) {
    const now = Date.now();
    const stage: ContestStage = !contest.published
      ? "draft"
      : contest.draw
        ? "completed"
        : now < contest.opensAt.getTime()
          ? "upcoming"
          : now < contest.closesAt.getTime()
            ? "open"
            : "review";
    return {
      ...contest,
      prizePresentation: prizePresentation(contest),
      prizePlaces: contest.prizeMode === "PLACES" ? contestPrizes(contest) : [],
      legalErrors: legalReadiness(contest),
      legalHref: contest.legalDocumentId
        ? conditionsHref(contest.slug, contest.legalDocumentId)
        : null,
      works: [],
      draw: mapContestDraw(contest.draw ?? null),
      appearance: contest.appearance as ContestAppearance,
      stage,
      opensAt: contest.opensAt.toISOString(),
      closesAt: contest.closesAt.toISOString(),
      drawAt: contest.drawAt.toISOString(),
      publishedAt: contest.publishedAt?.toISOString() ?? null,
      createdAt: contest.createdAt.toISOString(),
      updatedAt: contest.updatedAt.toISOString(),
    };
  }
  private rethrow(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new ConflictException("Конкурс с таким адресом уже существует");
    throwContestConsentError(error);
  }
}
