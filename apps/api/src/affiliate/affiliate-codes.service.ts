import { randomInt } from "node:crypto";

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import type { AuthUser } from "../auth/auth.types";
import {
  AffiliatePartnerStatus,
  Prisma,
  PromoCodeKind,
  PromoCodeType,
  UserRole,
  UserStatus,
} from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { normalizePromoCode } from "../promocodes/promocodes.service";

import type {
  CreateAffiliateCodeRequestDTO,
  ListAffiliateCodesQueryDTO,
  UpdateAffiliateCodeRequestDTO,
} from "./dto";
import { affiliateCodeLimit } from "./affiliate.types";

const generatedCodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const generatedCodeAttempts = 8;

type AffiliateCodeRecord = Prisma.PromoCodeGetPayload<Record<string, never>>;
type AffiliateTransaction = Prisma.TransactionClient;

@Injectable()
export class AffiliateCodesService {
  constructor(private readonly prisma: PrismaService) {}

  async listOwn(user: AuthUser, query: ListAffiliateCodesQueryDTO) {
    this.validateListQuery(query);
    const partner = await this.getPartnerByUserId(this.prisma, user.id);
    this.assertActivePartner(partner);
    return this.listByPartnerId(partner.id, query);
  }

  async listAdmin(userId: string, query: ListAffiliateCodesQueryDTO) {
    this.validateListQuery(query);
    const partner = await this.getPartnerByUserId(this.prisma, userId);
    if (!partner) throw new NotFoundException("Affiliate partner not found");
    return this.listByPartnerId(partner.id, query);
  }

  async createOwn(user: AuthUser, input: CreateAffiliateCodeRequestDTO) {
    this.validateCreateInput(input);
    const requestedCode = input.code
      ? normalizePromoCode(input.code)
      : undefined;
    const attempts = requestedCode ? 1 : generatedCodeAttempts;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const code = requestedCode ?? this.generateCode();
      try {
        return await this.prisma.$transaction(async (tx) => {
          await this.lockUser(tx, user.id);
          const partner = await this.getPartnerByUserId(tx, user.id);
          this.assertActivePartner(partner);
          const codeCount = await tx.promoCode.count({
            where: {
              affiliatePartnerId: partner.id,
              kind: PromoCodeKind.AFFILIATE,
            },
          });
          if (codeCount >= affiliateCodeLimit) {
            throw new ConflictException({
              message: `Можно создать не более ${affiliateCodeLimit} промокодов`,
              code: "affiliate_code_limit",
            });
          }
          const promo = await tx.promoCode.create({
            data: {
              code,
              kind: PromoCodeKind.AFFILIATE,
              name: code,
              description: null,
              type: PromoCodeType.PERCENTAGE,
              basisPoints: (20 - input.partnerPercent) * 100,
              amountKopecks: null,
              maxDiscountKopecks: null,
              minSubtotalKopecks: 0,
              startsAt: null,
              endsAt: null,
              maxUses: null,
              maxUsesPerUser: null,
              isActive: true,
              affiliatePartnerId: partner.id,
              affiliatePartnerPercent: input.partnerPercent,
              affiliateComment: input.comment?.trim() || null,
            },
          });
          return this.mapCode(promo);
        });
      } catch (error) {
        if (!this.isUniqueConstraintError(error)) throw error;
        if (requestedCode) {
          throw new ConflictException("Промокод с таким кодом уже существует");
        }
        if (attempt === attempts - 1) {
          throw new ConflictException("Не удалось сгенерировать уникальный промокод");
        }
      }
    }

    throw new ConflictException("Не удалось сгенерировать уникальный промокод");
  }

  updateOwn(
    user: AuthUser,
    codeId: string,
    input: UpdateAffiliateCodeRequestDTO,
  ) {
    return this.updateForOwner(user.id, codeId, input, true);
  }

  updateAdmin(
    userId: string,
    codeId: string,
    input: UpdateAffiliateCodeRequestDTO,
  ) {
    return this.updateForOwner(userId, codeId, input, false);
  }

  private async updateForOwner(
    userId: string,
    codeId: string,
    input: UpdateAffiliateCodeRequestDTO,
    requireActive: boolean,
  ) {
    this.validateUpdateInput(input);
    return this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, userId);
      const partner = await this.getPartnerByUserId(tx, userId);
      if (!partner) throw new NotFoundException("Affiliate partner not found");
      if (requireActive) this.assertActivePartner(partner);

      const locked = await tx.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`SELECT "id" FROM "promo_codes" WHERE "id" = ${codeId} FOR UPDATE`,
      );
      if (locked.length === 0) {
        throw new NotFoundException("Affiliate code not found");
      }
      const current = await tx.promoCode.findUnique({ where: { id: codeId } });
      if (
        !current ||
        current.kind !== PromoCodeKind.AFFILIATE ||
        current.affiliatePartnerId !== partner.id
      ) {
        throw new NotFoundException("Affiliate code not found");
      }

      const partnerPercent =
        input.partnerPercent ?? current.affiliatePartnerPercent;
      if (partnerPercent === null) {
        throw new Error("Affiliate code is missing its partner rate");
      }
      const promo = await tx.promoCode.update({
        where: { id: codeId },
        data: {
          ...(input.comment !== undefined
            ? { affiliateComment: input.comment?.trim() || null }
            : {}),
          ...(input.partnerPercent !== undefined
            ? {
                affiliatePartnerPercent: input.partnerPercent,
                basisPoints: (20 - input.partnerPercent) * 100,
              }
            : {}),
          ...(input.isActive !== undefined
            ? { isActive: input.isActive }
            : {}),
        },
      });
      return this.mapCode(promo);
    });
  }

  private async listByPartnerId(
    partnerId: string,
    query: ListAffiliateCodesQueryDTO,
  ) {
    const where = {
      affiliatePartnerId: partnerId,
      kind: PromoCodeKind.AFFILIATE,
    } satisfies Prisma.PromoCodeWhereInput;
    const [codes, total] = await this.prisma.$transaction([
      this.prisma.promoCode.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.promoCode.count({ where }),
    ]);
    return {
      items: codes.map((code) => this.mapCode(code)),
      total,
      page: query.page,
      pageSize: query.pageSize,
      limit: affiliateCodeLimit,
    };
  }

  private getPartnerByUserId(
    client: Pick<PrismaService, "affiliatePartner"> | AffiliateTransaction,
    userId: string,
  ) {
    return client.affiliatePartner.findUnique({
      where: { userId },
      select: {
        id: true,
        status: true,
        userId: true,
        user: { select: { id: true, roles: true, status: true } },
      },
    });
  }

  private assertActivePartner(
    partner: Awaited<ReturnType<AffiliateCodesService["getPartnerByUserId"]>>,
  ): asserts partner is NonNullable<typeof partner> {
    if (
      !partner ||
      partner.status !== AffiliatePartnerStatus.ACTIVE ||
      partner.user.status !== UserStatus.ACTIVE ||
      !partner.user.roles.includes(UserRole.PARTNER)
    ) {
      throw new ForbiddenException("Active partner profile required");
    }
  }

  private lockUser(tx: AffiliateTransaction, userId: string) {
    return tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "users" WHERE "id" = ${userId} FOR UPDATE`,
    );
  }

  private mapCode(promo: AffiliateCodeRecord) {
    if (promo.affiliatePartnerPercent === null) {
      throw new Error("Affiliate code is missing its partner rate");
    }
    return {
      id: promo.id,
      code: promo.code,
      comment: promo.affiliateComment,
      partnerPercent: promo.affiliatePartnerPercent,
      buyerPercent: 20 - promo.affiliatePartnerPercent,
      isActive: promo.isActive,
      createdAt: promo.createdAt.toISOString(),
      updatedAt: promo.updatedAt.toISOString(),
    };
  }

  private generateCode() {
    let suffix = "";
    for (let index = 0; index < 6; index += 1) {
      suffix += generatedCodeAlphabet[randomInt(generatedCodeAlphabet.length)];
    }
    return `ARTM-${suffix}`;
  }

  private validateCreateInput(input: CreateAffiliateCodeRequestDTO) {
    if (
      !Number.isInteger(input.partnerPercent) ||
      input.partnerPercent < 0 ||
      input.partnerPercent > 15
    ) {
      throw new BadRequestException(
        "partnerPercent должен быть целым числом от 0 до 15",
      );
    }
    if (input.code !== undefined && typeof input.code !== "string") {
      throw new BadRequestException("Некорректный формат промокода");
    }
    this.validateComment(input.comment);
  }

  private validateUpdateInput(input: UpdateAffiliateCodeRequestDTO) {
    if (
      input.comment === undefined &&
      input.partnerPercent === undefined &&
      input.isActive === undefined
    ) {
      throw new BadRequestException("Не указаны поля для изменения");
    }
    if (
      input.partnerPercent !== undefined &&
      (!Number.isInteger(input.partnerPercent) ||
        input.partnerPercent < 0 ||
        input.partnerPercent > 15)
    ) {
      throw new BadRequestException(
        "partnerPercent должен быть целым числом от 0 до 15",
      );
    }
    if (input.isActive !== undefined && typeof input.isActive !== "boolean") {
      throw new BadRequestException("isActive должен быть boolean");
    }
    this.validateComment(input.comment);
  }

  private validateComment(comment: unknown) {
    if (
      comment !== undefined &&
      comment !== null &&
      (typeof comment !== "string" || comment.trim().length > 500)
    ) {
      throw new BadRequestException(
        "Комментарий должен быть строкой длиной до 500 символов",
      );
    }
  }

  private validateListQuery(query: ListAffiliateCodesQueryDTO) {
    const skip = (query.page - 1) * query.pageSize;
    if (
      !Number.isSafeInteger(query.page) ||
      query.page < 1 ||
      query.page > 2_147_483_647 ||
      !Number.isSafeInteger(query.pageSize) ||
      query.pageSize < 1 ||
      query.pageSize > 100 ||
      !Number.isSafeInteger(skip) ||
      skip < 0 ||
      skip > 2_147_483_647
    ) {
      throw new BadRequestException("Некорректные параметры пагинации");
    }
  }

  private isUniqueConstraintError(error: unknown) {
    if (
      !(
        error instanceof Prisma.PrismaClientKnownRequestError ||
        (typeof error === "object" && error !== null && "code" in error)
      ) ||
      (error as { code?: unknown }).code !== "P2002"
    ) {
      return false;
    }
    const target = (error as { meta?: { target?: unknown } }).meta?.target;
    const standardTargetMatches = Array.isArray(target)
      ? target.length === 1 && target[0] === "code"
      : target === "code" || target === "promo_codes_code_key";
    if (standardTargetMatches) return true;

    const cause = (
      error as {
        meta?: {
          driverAdapterError?: {
            cause?: {
              constraint?: { fields?: unknown };
              kind?: unknown;
            };
          };
        };
      }
    ).meta?.driverAdapterError?.cause;
    const fields = cause?.constraint?.fields;
    return (
      cause?.kind === "UniqueConstraintViolation" &&
      Array.isArray(fields) &&
      fields.length === 1 &&
      fields[0] === "code"
    );
  }
}
