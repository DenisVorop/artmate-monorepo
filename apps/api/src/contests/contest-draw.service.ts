import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { createHash, randomInt } from "node:crypto";
import { Prisma, type Contest } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  contestEntryInclude,
  mapContestWork,
  publicContestEntryWhere,
} from "./contest-entry-read-model";
import { contestDrawInclude, mapContestDraw } from "./contest-draw-read-model";
import type { ManualContestDrawRequestDTO } from "./dto/contest-draw-request.dto";

@Injectable()
export class ContestDrawService {
  private readonly logger = new Logger(ContestDrawService.name);
  constructor(private readonly prisma: PrismaService) {}

  async getAdmin(contestId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, contestId);
      const contest = await this.contest(tx, contestId);
      const result = await this.result(tx, contestId);
      if (result)
        return {
          contest: this.summary(contest),
          result,
          candidates: [],
          pendingCount: 0,
          rosterToken: null,
          blocker: null,
        };
      const roster = await this.roster(tx, contest);
      return {
        contest: this.summary(contest),
        result: null,
        candidates: roster.eligible.map((entry) => ({
          entryId: entry.id,
          version: entry.version,
          work: mapContestWork(entry),
        })),
        pendingCount: roster.pendingCount,
        rosterToken: roster.token,
        blocker: this.blocker(contest, roster.pendingCount),
      };
    });
  }

  async selectManual(
    contestId: string,
    actorId: string,
    input: ManualContestDrawRequestDTO,
  ) {
    await this.prisma.$transaction(
      async (tx) => {
        await this.lock(tx, contestId);
        const contest = await this.contest(tx, contestId);
        if (contest.selectionMode !== "MANUAL")
          throw new ConflictException(
            "В этом конкурсе победителей выбираем автоматически",
          );
        const existing = await tx.contestDraw.findUnique({
          where: { contestId },
          include: { winners: { orderBy: { entryId: "asc" } } },
        });
        if (existing) {
          if (
            JSON.stringify(existing.winners.map((winner) => winner.entryId)) !==
            JSON.stringify([...input.entryIds].sort())
          )
            throw new ConflictException(
              "Результат уже опубликован. Изменить победителей нельзя",
            );
          return;
        }
        const roster = await this.roster(tx, contest);
        const blocker = this.blocker(contest, roster.pendingCount);
        if (blocker) throw new ConflictException(blocker);
        if (roster.token !== input.rosterToken)
          throw new ConflictException(
            "Список участников изменился. Обновите страницу и проверьте выбор",
          );
        const count = Math.min(contest.winnersCount, roster.eligible.length);
        if (
          input.entryIds.length !== count ||
          new Set(input.entryIds).size !== count ||
          input.entryIds.some(
            (id) => !roster.eligible.some((entry) => entry.id === id),
          )
        )
          throw new ConflictException(
            `Выберите ${count} победителей из допущенных работ`,
          );
        await this.save(
          tx,
          contest,
          roster,
          [...input.entryIds].sort(),
          actorId,
        );
      },
      { timeout: 30_000 },
    );
    return this.getAdmin(contestId);
  }

  async runDue() {
    const due = await this.prisma.contest.findMany({
      where: {
        published: true,
        selectionMode: "AUTOMATIC",
        drawAt: { lte: new Date() },
        draw: { is: null },
      },
      select: { id: true },
      orderBy: [{ drawAt: "asc" }, { id: "asc" }],
    });
    for (const contest of due) {
      try {
        await this.selectAutomatic(contest.id);
      } catch (error) {
        this.logger.error(
          `Contest draw failed: ${contest.id}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
  }

  async selectAutomatic(contestId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        await this.lock(tx, contestId);
        const contest = await this.contest(tx, contestId);
        if (
          contest.selectionMode !== "AUTOMATIC" ||
          (await tx.contestDraw.findUnique({ where: { contestId } }))
        )
          return false;
        const roster = await this.roster(tx, contest);
        if (this.blocker(contest, roster.pendingCount)) return false;
        // Fisher–Yates gives each eligible entry the same chance, with no duplicates.
        const order = roster.eligible.map((entry) => entry.id);
        for (let i = order.length - 1; i > 0; i--) {
          const j = randomInt(i + 1);
          [order[i], order[j]] = [order[j]!, order[i]!];
        }
        await this.save(tx, contest, roster, order, null);
        return true;
      },
      { timeout: 30_000 },
    );
  }

  private async roster(tx: Prisma.TransactionClient, contest: Contest) {
    const pendingEntries = await tx.contestEntry.count({
      where: {
        contestId: contest.id,
        status: { in: ["PENDING", "CHANGES_REQUESTED"] },
      },
    });
    const pendingCount =
      pendingEntries +
      (await tx.contestEntrySubmission.count({
        where: { contestId: contest.id, status: "PENDING" },
      }));
    const eligible = await tx.contestEntry.findMany({
      where: { ...publicContestEntryWhere(), contestId: contest.id },
      include: contestEntryInclude,
      orderBy: { id: "asc" },
    });
    const snapshot = eligible.map((entry) => ({
      entryId: entry.id,
      publicId: entry.publicId,
      userId: entry.userId,
      version: entry.version,
      revision: entry.revision,
    }));
    const hash = createHash("sha256")
      .update(JSON.stringify(snapshot))
      .digest("hex");
    const token = createHash("sha256")
      .update(
        JSON.stringify({
          version: contest.version,
          mode: contest.selectionMode,
          count: contest.winnersCount,
          pendingCount,
          hash,
        }),
      )
      .digest("hex");
    return { eligible, pendingCount, snapshot, hash, token };
  }

  private blocker(contest: Contest, pendingCount: number) {
    if (!contest.published) return "Сначала опубликуйте конкурс";
    if (Date.now() < contest.closesAt.getTime())
      return "Приём работ ещё открыт";
    if (Date.now() < contest.drawAt.getTime())
      return "Время выбора победителей ещё не наступило";
    if (pendingCount)
      return "Проверьте оставшиеся заявки перед выбором победителей";
    return null;
  }
  private async save(
    tx: Prisma.TransactionClient,
    contest: Contest,
    roster: Awaited<ReturnType<ContestDrawService["roster"]>>,
    order: string[],
    actorId: string | null,
  ) {
    const entries = new Map(roster.eligible.map((entry) => [entry.id, entry]));
    await tx.contestDraw.create({
      data: {
        createdAt: new Date(),
        contestId: contest.id,
        mode: contest.selectionMode,
        actorId,
        requestedWinners: contest.winnersCount,
        eligibleCount: roster.eligible.length,
        eligibility: roster.snapshot,
        eligibilityHash: roster.hash,
        selectionOrder: order,
        algorithm: actorId ? "manual-v1" : "crypto-fisher-yates-v1",
        winners: {
          create: order.slice(0, contest.winnersCount).map((id) => ({
            entryId: id,
            entryVersion: entries.get(id)!.version,
            revision: entries.get(id)!.revision,
          })),
        },
      },
    });
  }
  private async lock(tx: Prisma.TransactionClient, id: string) {
    await tx.$queryRaw`SELECT id FROM contests WHERE id = ${id} FOR UPDATE`;
  }
  private async contest(tx: Prisma.TransactionClient, id: string) {
    const contest = await tx.contest.findUnique({ where: { id } });
    if (!contest) throw new NotFoundException("Конкурс не найден");
    return contest;
  }
  private async result(tx: Prisma.TransactionClient, contestId: string) {
    return mapContestDraw(
      await tx.contestDraw.findUnique({
        where: { contestId },
        include: contestDrawInclude,
      }),
      true,
    );
  }
  private summary(contest: Contest) {
    return {
      id: contest.id,
      title: contest.title,
      slug: contest.slug,
      selectionMode: contest.selectionMode,
      winnersCount: contest.winnersCount,
      drawAt: contest.drawAt.toISOString(),
    };
  }
}
