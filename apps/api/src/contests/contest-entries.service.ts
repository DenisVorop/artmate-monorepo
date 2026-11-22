import { randomBytes } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  Logger,
} from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { Prisma, ContestEntryStatus } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  UserPhotoMediaService,
  type UserPhotoUpload,
} from "../user-photos/user-photo-media.service";
import { ContestPhotoStorageService } from "./contest-photo-storage.service";
import {
  SubmitContestEntryDTO,
  ContestEntryDecisionDTO,
} from "./dto/contest-entry-request.dto";
import {
  contestEntryInclude,
  publicContestEntryWhere,
  type ContestEntryRecord,
} from "./contest-entry-read-model";

type Asset = { key: string; checksum: string; width: number; height: number };
type Assets = Record<"normalized" | "web" | "thumb", Asset>;
const editable = [
  ContestEntryStatus.PENDING,
  ContestEntryStatus.CHANGES_REQUESTED,
];

import { setTimeout } from "node:timers/promises";
import {
  ConsentOperations,
  ConsentOperationError,
} from "../consents/contracts/consent-operations.contract";
import { throwContestConsentError } from "./legal/contest-consent-errors";
import type { RequestEvidenceV1 } from "../common/request-evidence";
import {
  assertContestConsentOffer,
  prepareContestConsent,
  entryConsentContext,
  enqueueContestAcceptance,
  type EntryLegalAcceptance,
} from "./legal/contest-consent";

@Injectable()
export class ContestEntriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: UserPhotoMediaService,
    private readonly storage: ContestPhotoStorageService,
  ) {}

  prepareConsent(slug: string, userId: string) {
    return prepareContestConsent(this.prisma, slug, userId);
  }
  private readonly logger = new Logger(ContestEntriesService.name);
  private resuming: Promise<void> | null = null;

  async mine(slug: string, userId: string) {
    const contest = await this.prisma.contest.findFirst({
      where: { slug, published: true },
    });
    if (!contest) throw new NotFoundException("Конкурс не найден");
    const pending = await this.prisma.contestEntrySubmission.findFirst({
      where: { contestId: contest.id, userId, status: "PENDING" },
      select: { id: true },
    });
    if (pending) await this.finishSubmission(pending.id);
    const entry = await this.prisma.contestEntry.findUnique({
      where: { contestId_userId: { contestId: contest.id, userId } },
      include: contestEntryInclude,
    });
    return entry ? this.mapPrivate(entry) : null;
  }

  async submit(
    slug: string,
    userId: string,
    payload: string,
    file?: UserPhotoUpload,
    evidence?: RequestEvidenceV1,
  ) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      throw new BadRequestException("Проверьте поля заявки");
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new BadRequestException("Проверьте поля заявки");
    const input = plainToInstance(SubmitContestEntryDTO, parsed);
    if (
      (await validate(input, { whitelist: true, forbidNonWhitelisted: true }))
        .length
    )
      throw new BadRequestException(
        "Проверьте поля заявки и подтвердите правила и согласия",
      );
    const contest = await this.prisma.contest.findFirst({
      where: { slug, published: true },
    });
    if (!contest) throw new NotFoundException("Конкурс не найден");
    this.assertOpen(contest);
    await assertContestConsentOffer(this.prisma, contest, userId, input);
    const current = await this.prisma.contestEntry.findUnique({
      where: { contestId_userId: { contestId: contest.id, userId } },
      include: contestEntryInclude,
    });
    this.assertEditable(current, input.version);
    if (!current && !file) throw new BadRequestException("Выберите фотографию");
    const entryId = current?.id ?? randomBytes(16).toString("hex");
    const revisionId = randomBytes(16).toString("hex");
    let assets = current?.revisions[0]?.assets as Assets | undefined;
    const storedKeys: string[] = [];
    let durablyStaged = false;
    try {
      if (file) {
        let processed;
        try {
          processed = await this.media.processPhoto(file);
        } catch (error) {
          if (error instanceof BadRequestException)
            throw new BadRequestException(
              "Не удалось прочитать фотографию. Выберите JPEG, PNG или WebP до 10 МБ, не больше 8000 пикселей по стороне",
            );
          throw error;
        }
        assets = {} as Assets;
        const files = (["normalized", "web", "thumb"] as const).map(
          (variant) => {
            const photo = processed[variant];
            const key = `${entryId}/${revisionId}/${variant}-${photo.checksum}.webp`;
            assets![variant] = {
              key,
              checksum: photo.checksum,
              width: photo.width,
              height: photo.height,
            };
            return { key, buffer: photo.buffer, checksum: photo.checksum };
          },
        );
        storedKeys.push(
          ...(await this.storage.writeAssets(files))
            .filter((item) => item.created)
            .map((item) => item.key),
        );
      }
      if (!evidence)
        throw new BadRequestException(
          "Не удалось подтвердить отправку. Обновите форму",
        );
      const submission = await this.prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM contests WHERE id = ${contest.id} FOR UPDATE`;
          const freshContest = await tx.contest.findUniqueOrThrow({
            where: { id: contest.id },
          });
          this.assertOpen(freshContest);
          const offer = await assertContestConsentOffer(
            tx,
            freshContest,
            userId,
            input,
          );
          if (
            await tx.contestEntrySubmission.count({
              where: { contestId: contest.id, userId, status: "PENDING" },
            })
          )
            throw new ConflictException(
              "Работа уже отправляется. Проверьте заявку чуть позже",
            );
          if (
            await tx.contestEntrySubmission.findUnique({
              where: { offerId: offer.id },
            })
          )
            throw new ConflictException(
              "Подтверждения уже использованы. Обновите документы в форме",
            );
          const fresh = await tx.contestEntry.findUnique({
            where: { contestId_userId: { contestId: contest.id, userId } },
            include: contestEntryInclude,
          });
          this.assertEditable(fresh, input.version);
          const product = await tx.product.findFirst({
            where: {
              id: input.albumId,
              status: "PUBLISHED",
              OR: [
                { categoryId: null },
                { category: { is: { slug: { not: "markery" } } } },
              ],
            },
          });
          if (!product)
            throw new BadRequestException("Выберите альбом из каталога");
          if (
            input.number !== undefined &&
            !(await tx.coloring.findFirst({
              where: {
                number: input.number,
                status: "PUBLISHED",
                collection: {
                  is: { productId: product.id, status: "PUBLISHED" },
                },
              },
              select: { id: true },
            }))
          )
            throw new BadRequestException(
              "В этом альбоме нет такой картинки. Проверьте номер или оставьте поле пустым",
            );
          const consent = await enqueueContestAcceptance(
            tx,
            freshContest,
            userId,
            input,
            offer,
            assets!.normalized,
            revisionId,
            evidence,
          );
          return tx.contestEntrySubmission.create({
            data: {
              id: revisionId,
              contestId: contest.id,
              userId,
              entryId: fresh?.id ?? entryId,
              publicId: fresh?.publicId ?? randomBytes(12).toString("hex"),
              offerId: offer.id,
              consentCommandId: consent.commandId,
              expectedVersion: input.version,
              revision: (fresh?.revision ?? 0) + 1,
              storedKeys,
              data: {
                productId: product.id,
                number: input.number ?? null,
                caption: input.caption,
                assets: assets!,
                publication: consent.publication,
                contestSnapshot: {
                  legalDocumentId: freshContest.legalDocumentId,
                  version: freshContest.version,
                  title: freshContest.title,
                  task: freshContest.task,
                  rules: freshContest.rules,
                  prize: freshContest.prize,
                  prizeDetail: freshContest.prizeDetail,
                  winnersCount: freshContest.winnersCount,
                  selectionMode: freshContest.selectionMode,
                  opensAt: freshContest.opensAt.toISOString(),
                  closesAt: freshContest.closesAt.toISOString(),
                  drawAt: freshContest.drawAt.toISOString(),
                },
              } as unknown as Prisma.InputJsonValue,
            },
          });
        },
        { timeout: 10_000 },
      );
      durablyStaged = true;
      return await this.waitForSubmission(submission.id);
    } catch (error) {
      if (!durablyStaged) await this.storage.cleanup(storedKeys);
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        throw this.conflict();
      throwContestConsentError(error);
    }
  }

  async processPendingSubmissions(): Promise<void> {
    if (this.resuming) return this.resuming;
    this.resuming = (async () => {
      const pending = await this.prisma.contestEntrySubmission.findMany({
        where: { status: "PENDING" },
        select: { id: true },
        orderBy: { createdAt: "asc" },
        take: 20,
      });
      for (const submission of pending) {
        try {
          await this.finishSubmission(submission.id);
        } catch {
          this.logger.warn("Contest submission finalization will be retried");
        }
      }
    })().finally(() => {
      this.resuming = null;
    });
    return this.resuming;
  }
  private async waitForSubmission(id: string) {
    const until = Date.now() + 15_000;
    do {
      await this.finishSubmission(id);
      const submission =
        await this.prisma.contestEntrySubmission.findUniqueOrThrow({
          where: { id },
        });
      if (submission.status === "COMPLETED")
        return this.mapPrivate(await this.find(submission.entryId));
      if (submission.status === "REJECTED")
        throwContestConsentError(
          new ConsentOperationError(submission.errorCode!),
        );
      await setTimeout(75);
    } while (Date.now() < until);
    throw new ServiceUnavailableException(
      "Работа ещё отправляется. Проверьте заявку чуть позже",
    );
  }
  private async finishSubmission(id: string) {
    const initial = await this.prisma.contestEntrySubmission.findUniqueOrThrow({
      where: { id },
    });
    if (initial.status !== "PENDING") return;
    const receipt = await ConsentOperations.result(
      this.prisma,
      initial.consentCommandId,
    );
    if (!receipt || receipt.status === "PENDING") return;
    const rejectedKeys = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM contests WHERE id = ${initial.contestId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM contest_entry_submissions WHERE id = ${id} FOR UPDATE`;
      const submission = await tx.contestEntrySubmission.findUniqueOrThrow({
        where: { id },
      });
      if (submission.status !== "PENDING") return [];
      const data = submission.data as unknown as {
        productId: string;
        number: number | null;
        caption: string;
        assets: Assets;
        publication: Prisma.InputJsonValue;
        contestSnapshot: Prisma.InputJsonValue & { legalDocumentId: string };
      };
      const result = receipt.status === "COMPLETED" ? receipt.result : null;
      const contest = await tx.contest.findUniqueOrThrow({
        where: { id: submission.contestId },
      });
      const context = entryConsentContext(contest, submission.userId);
      const current = await tx.contestEntry.findUnique({
        where: {
          contestId_userId: {
            contestId: submission.contestId,
            userId: submission.userId,
          },
        },
        include: contestEntryInclude,
      });
      let errorCode = receipt.status === "REJECTED" ? receipt.errorCode : null;
      if (
        !errorCode &&
        (!result ||
          result.type !== "ACCEPT" ||
          result.offerId !== submission.offerId ||
          result.context.userId !== context.userId ||
          result.context.subjectId !== context.subjectId ||
          result.context.purpose !== context.purpose ||
          result.context.contextKey !== data.contestSnapshot.legalDocumentId ||
          result.context.contextKey !== context.contextKey)
      )
        errorCode = "RESULT_CONTEXT_CHANGED";
      if (
        !errorCode &&
        !(await tx.product.findUnique({
          where: { id: data.productId },
          select: { id: true },
        }))
      )
        errorCode = "ALBUM_UNAVAILABLE";
      if (!errorCode) {
        const actor = await tx.$queryRaw<
          { user_id: string }[]
        >`SELECT user_id FROM customer_auth_directory_v1 WHERE user_id = ${submission.userId}`;
        if (!actor.length) errorCode = "INVALID_PROOF";
      }
      if (
        !errorCode &&
        ((!current && submission.expectedVersion !== null) ||
          (current &&
            (current.id !== submission.entryId ||
              current.version !== submission.expectedVersion ||
              !editable.includes(current.status as (typeof editable)[number]))))
      )
        errorCode = "ENTRY_CHANGED";
      if (errorCode || !result || result.type !== "ACCEPT") {
        await tx.contestEntrySubmission.update({
          where: { id },
          data: {
            status: "REJECTED",
            errorCode: errorCode ?? "INVALID_RESULT",
            finishedAt: new Date(),
          },
        });
        return submission.storedKeys;
      }
      const version = (current?.version ?? 0) + 1;
      if (current)
        await tx.contestEntry.update({
          where: { id: current.id },
          data: {
            version,
            revision: submission.revision,
            status: "PENDING",
            publicationEndsAt: new Date(result.endsAt),
          },
        });
      else
        await tx.contestEntry.create({
          data: {
            id: submission.entryId,
            publicId: submission.publicId,
            contestId: submission.contestId,
            userId: submission.userId,
            contestSnapshot: data.contestSnapshot,
            publicationEndsAt: new Date(result.endsAt),
            createdAt: submission.createdAt,
          },
        });
      await tx.contestEntryRevision.create({
        data: {
          id,
          entryId: submission.entryId,
          sequence: submission.revision,
          productId: data.productId,
          number: data.number,
          caption: data.caption,
          assets: data.assets as unknown as Prisma.InputJsonValue,
          consentAcceptanceIds: result.acceptanceIds,
          publicationSnapshot: data.publication,
          createdAt: submission.createdAt,
        },
      });
      await tx.contestEntryEvent.create({
        data: {
          entryId: submission.entryId,
          actorId: submission.userId,
          revision: submission.revision,
          version,
          status: "PENDING",
        },
      });
      await tx.contestEntrySubmission.update({
        where: { id },
        data: { status: "COMPLETED", finishedAt: new Date() },
      });
      return [];
    });
    await this.storage.cleanup(rejectedKeys);
  }

  async list(contestId: string, status?: string, cursor?: string) {
    if (
      status &&
      !Object.values(ContestEntryStatus).includes(status as ContestEntryStatus)
    )
      throw new BadRequestException("Неизвестный статус заявки");
    if (
      cursor !== undefined &&
      (typeof cursor !== "string" || !/^[0-9a-f]{32}$/.test(cursor))
    )
      throw new BadRequestException("Обновите список заявок");
    const rows = await this.prisma.contestEntry.findMany({
      where: {
        contestId,
        ...(status ? { status: status as ContestEntryStatus } : {}),
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      include: contestEntryInclude,
      orderBy: { id: "asc" },
      take: 51,
    });
    return {
      entries: await Promise.all(
        rows.slice(0, 50).map((entry) => this.mapPrivate(entry, true)),
      ),
      nextCursor: rows.length > 50 ? rows[49]!.id : null,
    };
  }
  async detail(id: string) {
    return this.mapPrivate(await this.find(id), true);
  }
  async decide(id: string, actorId: string, input: ContestEntryDecisionDTO) {
    if (input.status === "PENDING")
      throw new BadRequestException("Выберите решение по заявке");
    const reason = input.reason?.trim();
    if (input.status !== "APPROVED" && !reason)
      throw new BadRequestException("Укажите причину решения");
    return this.prisma.$transaction(async (tx) => {
      const identity = await tx.contestEntry.findUnique({
        where: { id },
        select: { contestId: true },
      });
      if (!identity) throw new NotFoundException("Заявка не найдена");
      // Every change affecting eligibility shares the draw's contest lock.
      await tx.$queryRaw`SELECT id FROM contests WHERE id = ${identity.contestId} FOR UPDATE`;
      const awaiting = await tx.contestEntrySubmission.findFirst({
        where: { entryId: id, status: "PENDING" },
        select: { id: true },
      });
      if (awaiting)
        throw new ConflictException(
          "Работа ещё отправляется. Обновите заявку чуть позже",
        );

      const entry = await tx.contestEntry.findUnique({
        where: { id },
        include: contestEntryInclude,
      });
      if (!entry) throw new NotFoundException("Заявка не найдена");
      if (entry.version !== input.version) throw this.conflict();
      const allowed =
        input.status === "HIDDEN"
          ? entry.status === "APPROVED"
          : entry.status === "PENDING" ||
            (entry.status === "CHANGES_REQUESTED" &&
              input.status !== "CHANGES_REQUESTED") ||
            (input.status === "APPROVED" && entry.status === "HIDDEN");
      if (!allowed)
        throw new ConflictException(
          "Для этой заявки решение уже принято. Обновите страницу",
        );
      if (
        input.status === "CHANGES_REQUESTED" &&
        Date.now() >= entry.contest.closesAt.getTime()
      )
        throw new ConflictException(
          "Приём работ завершён. Одобрите или отклоните заявку",
        );
      if (
        input.status === "APPROVED" &&
        (!entry.contest.published ||
          !(await tx.user.findFirst({
            where: { id: entry.userId, status: "ACTIVE", deletedAt: null },
          })))
      )
        throw new ConflictException("Конкурс или аккаунт участника недоступен");
      const changed = await tx.contestEntry.updateMany({
        where: { id, version: input.version, status: entry.status },
        data: {
          status: input.status,
          version: { increment: 1 },
          ...(input.status === "APPROVED"
            ? { publishedAt: entry.publishedAt ?? new Date() }
            : {}),
        },
      });
      if (!changed.count) throw this.conflict();
      await tx.contestEntryEvent.create({
        data: {
          entryId: id,
          actorId,
          revision: entry.revision,
          version: entry.version + 1,
          status: input.status,
          reason: input.status === "APPROVED" ? null : reason,
        },
      });
      return this.mapPrivate(
        await tx.contestEntry.findUniqueOrThrow({
          where: { id },
          include: contestEntryInclude,
        }),
        true,
      );
    });
  }

  async ownerPhoto(id: string, revisionId: string, userId: string) {
    const entry = await this.prisma.contestEntry.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!entry) throw new NotFoundException("Фотография не найдена");
    return this.revisionPhoto(id, revisionId, "web");
  }
  async adminPhoto(id: string, revisionId: string) {
    return this.revisionPhoto(id, revisionId, "normalized");
  }
  async publicPhoto(publicId: string, variant: string) {
    if (variant !== "web" && variant !== "thumb")
      throw new NotFoundException("Фотография не найдена");
    const entry = await this.prisma.contestEntry.findFirst({
      where: { ...publicContestEntryWhere(), publicId },
      include: contestEntryInclude,
    });
    if (!entry) throw new NotFoundException("Фотография не найдена");
    return this.readAssets(entry.revisions[0]!.assets, variant);
  }
  private async revisionPhoto(
    entryId: string,
    id: string,
    variant: "web" | "normalized",
  ) {
    const revision = await this.prisma.contestEntryRevision.findFirst({
      where: { id, entryId },
    });
    if (!revision) throw new NotFoundException("Фотография не найдена");
    return this.readAssets(revision.assets, variant);
  }
  private readAssets(value: Prisma.JsonValue, variant: keyof Assets) {
    const asset = (value as Assets)[variant];
    return this.storage.read(asset.key, asset);
  }
  private async find(id: string) {
    const entry = await this.prisma.contestEntry.findUnique({
      where: { id },
      include: contestEntryInclude,
    });
    if (!entry) throw new NotFoundException("Заявка не найдена");
    return entry;
  }
  private assertOpen(contest: {
    published: boolean;
    opensAt: Date;
    closesAt: Date;
  }) {
    if (
      !contest.published ||
      Date.now() < contest.opensAt.getTime() ||
      Date.now() >= contest.closesAt.getTime()
    )
      throw new ConflictException("Приём работ закрыт");
  }
  private assertEditable(entry: ContestEntryRecord | null, version?: number) {
    if (!entry) {
      if (version !== undefined) throw this.conflict();
      return;
    }
    if (version !== entry.version) throw this.conflict();
    if (!editable.includes(entry.status as (typeof editable)[number]))
      throw new ConflictException("Эту заявку уже нельзя изменить");
  }
  private conflict() {
    return new ConflictException(
      "Заявка уже изменена. Обновите страницу перед отправкой",
    );
  }
  private async mapPrivate(entry: ContestEntryRecord, admin = false) {
    const revision = entry.revisions[0]!;
    const consentAcceptances = admin
      ? await ConsentOperations.acceptances(
          this.prisma,
          revision.consentAcceptanceIds,
        )
      : [];
    return {
      id: entry.id,
      publicId: entry.publicId,
      version: entry.version,
      status: entry.status,
      revisionId: revision.id,
      albumId: revision.productId,
      albumTitle: revision.product.title,
      number: revision.number,
      caption: revision.caption,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
      canEdit:
        editable.includes(entry.status as (typeof editable)[number]) &&
        entry.contest.published &&
        Date.now() < entry.contest.closesAt.getTime(),
      reason: entry.events[0]?.reason ?? null,
      ...(admin
        ? {
            contest: {
              id: entry.contest.id,
              title: entry.contest.title,
              closesAt: entry.contest.closesAt.toISOString(),
              task: entry.contest.task,
              rules: entry.contest.rules,
            },
            consentAcceptances,
            legalAcceptance: revision.consentAcceptanceIds.length
              ? (consentAcceptances[0]
                  ?.individualPart as unknown as EntryLegalAcceptance)
              : null,
            author: {
              name: entry.user.name?.trim() || "Автор",
              email: entry.user.email,
            },
            events: entry.events.map((event) => ({
              id: event.id,
              status: event.status,
              reason: event.reason,
              revision: event.revision,
              actor: event.actor.name?.trim() || "Пользователь",
              createdAt: event.createdAt.toISOString(),
            })),
          }
        : {}),
    };
  }
}
