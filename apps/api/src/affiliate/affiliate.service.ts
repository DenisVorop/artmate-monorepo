import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import type { AuthUser } from "../auth/auth.types";
import {
  AffiliatePartnerStatus as PrismaAffiliatePartnerStatus,
  AuthProvider as PrismaAuthProvider,
  Prisma,
  UserRole as PrismaUserRole,
  UserStatus as PrismaUserStatus,
} from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";

import {
  defaultMinimumPayoutKopecks,
  type AffiliatePartnerStatus,
} from "./affiliate.types";
import { isAffiliateContractDateInFuture } from "./affiliate-date";
import type {
  ListAffiliatePartnersQueryDTO,
  PutAffiliatePartnerRequestDTO,
} from "./dto";

const partnerWithUser = {
  user: { select: { email: true, name: true } },
} satisfies Prisma.AffiliatePartnerInclude;

type StoredPartner = Prisma.AffiliatePartnerGetPayload<{
  include: typeof partnerWithUser;
}>;

@Injectable()
export class AffiliateService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrentPartner(user: AuthUser) {
    if (!user.roles.includes("partner")) {
      throw new ForbiddenException("Active partner profile required");
    }

    const partner = await this.prisma.affiliatePartner.findUnique({
      where: { userId: user.id },
      include: partnerWithUser,
    });

    if (!partner || partner.status !== PrismaAffiliatePartnerStatus.ACTIVE) {
      throw new ForbiddenException("Active partner profile required");
    }

    return this.mapPartner(partner);
  }

  async listPartners(query: ListAffiliatePartnersQueryDTO) {
    const search = query.search?.trim();
    const where: Prisma.AffiliatePartnerWhereInput = search
      ? {
          user: {
            OR: [
              { email: { contains: search, mode: "insensitive" } },
              { name: { contains: search, mode: "insensitive" } },
            ],
          },
        }
      : {};
    const select = {
      id: true,
      userId: true,
      user: { select: { email: true, name: true } },
      status: true,
      partnerApplicationId: true,
      minimumPayoutKopecks: true,
      contractVersion: true,
      createdAt: true,
      updatedAt: true,
    } satisfies Prisma.AffiliatePartnerSelect;
    const [partners, total] = await this.prisma.$transaction([
      this.prisma.affiliatePartner.findMany({
        where,
        select,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.affiliatePartner.count({ where }),
    ]);

    return {
      items: partners.map((partner) => this.mapPartnerSummary(partner)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async getPartner(userId: string) {
    const partner = await this.prisma.affiliatePartner.findUnique({
      where: { userId },
      include: partnerWithUser,
    });

    if (!partner) {
      throw new NotFoundException("Affiliate partner not found");
    }

    return this.mapPartner(partner);
  }

  async getContractHistory(userId: string) {
    const partner = await this.prisma.affiliatePartner.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!partner) {
      throw new NotFoundException("Affiliate partner not found");
    }

    const revisions = await this.prisma.affiliateContractRevision.findMany({
      where: { partnerId: partner.id },
      orderBy: [{ version: "desc" }],
    });

    return revisions.map((revision) => ({
      version: revision.version,
      number: revision.number,
      signedAt: revision.signedAt.toISOString(),
      paymentDetails: revision.paymentDetails,
      changedAt: revision.changedAt.toISOString(),
      changedByUserId: revision.changedByUserId,
    }));
  }

  async putPartner(
    userId: string,
    input: PutAffiliatePartnerRequestDTO,
    actor: AuthUser,
  ) {
    const contract = {
      number: input.contract.number.trim(),
      signedAt: new Date(input.contract.signedAt),
      paymentDetails: input.contract.paymentDetails.trim(),
    };

    if (
      !contract.number ||
      !contract.paymentDetails ||
      Number.isNaN(contract.signedAt.getTime()) ||
      isAffiliateContractDateInFuture(contract.signedAt)
    ) {
      throw new BadRequestException(
        "Contract is invalid or signed in the future",
      );
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const [lockedUser] = await tx.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`SELECT "id" FROM "users" WHERE "id" = ${userId} FOR UPDATE`,
        );

        if (!lockedUser) {
          throw new NotFoundException("User not found");
        }

        const user = await tx.user.findUnique({
          where: { id: userId },
          select: {
            email: true,
            emailVerifiedAt: true,
            id: true,
            name: true,
            roles: true,
            status: true,
            authAccounts: {
              where: { provider: PrismaAuthProvider.YANDEX },
              select: { id: true },
              take: 1,
            },
            affiliatePartner: true,
          },
        });

        if (!user) {
          throw new NotFoundException("User not found");
        }

        if (
          user.status !== PrismaUserStatus.ACTIVE ||
          (!user.emailVerifiedAt && user.authAccounts.length === 0)
        ) {
          throw new BadRequestException(
            "Partner account must be active and verified",
          );
        }

        if (input.partnerApplicationId) {
          const application = await tx.partnerApplication.findUnique({
            where: { id: input.partnerApplicationId },
            select: {
              id: true,
              affiliatePartner: { select: { userId: true } },
            },
          });

          if (!application) {
            throw new BadRequestException("Partner application not found");
          }

          if (
            application.affiliatePartner &&
            application.affiliatePartner.userId !== userId
          ) {
            throw new ConflictException(
              "Partner application is already linked",
            );
          }
        }

        const status = this.toPrismaStatus(input.status);
        const current = user.affiliatePartner;
        const contractChanged =
          !current ||
          current.contractNumber !== contract.number ||
          current.contractSignedAt.getTime() !== contract.signedAt.getTime() ||
          current.contractPaymentDetails !== contract.paymentDetails;
        const contractVersion = current
          ? current.contractVersion + (contractChanged ? 1 : 0)
          : 1;
        const data = {
          status,
          partnerApplicationId: input.partnerApplicationId,
          minimumPayoutKopecks:
            input.minimumPayoutKopecks === null
              ? null
              : BigInt(input.minimumPayoutKopecks),
          contractNumber: contract.number,
          contractSignedAt: contract.signedAt,
          contractPaymentDetails: contract.paymentDetails,
          contractVersion,
        };
        const partner = current
          ? await tx.affiliatePartner.update({
              where: { id: current.id },
              data,
            })
          : await tx.affiliatePartner.create({
              data: { ...data, userId },
            });

        const roles: PrismaUserRole[] = user.roles.filter(
          (role) => role !== PrismaUserRole.PARTNER,
        );

        if (status === PrismaAffiliatePartnerStatus.ACTIVE) {
          roles.push(PrismaUserRole.PARTNER);
        }

        await tx.user.update({
          where: { id: userId },
          data: { roles },
        });

        if (contractChanged) {
          await tx.affiliateContractRevision.create({
            data: {
              partnerId: partner.id,
              version: contractVersion,
              number: contract.number,
              signedAt: contract.signedAt,
              paymentDetails: contract.paymentDetails,
              changedByUserId: actor.id,
            },
          });
        }

        return this.mapPartner({ ...partner, user });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("Partner application is already linked");
      }

      throw error;
    }
  }

  private mapPartner(partner: StoredPartner) {
    return {
      ...this.mapPartnerSummary(partner),
      contract: {
        number: partner.contractNumber,
        signedAt: partner.contractSignedAt.toISOString(),
        paymentDetails: partner.contractPaymentDetails,
      },
    };
  }

  private mapPartnerSummary(partner: {
    id: string;
    userId: string;
    user: { email: string | null; name: string | null };
    status: PrismaAffiliatePartnerStatus;
    partnerApplicationId: string | null;
    minimumPayoutKopecks: bigint | null;
    contractVersion: number;
    createdAt: Date;
    updatedAt: Date;
  }) {
    const minimumPayoutKopecks =
      partner.minimumPayoutKopecks === null
        ? null
        : Number(partner.minimumPayoutKopecks);

    return {
      id: partner.id,
      userId: partner.userId,
      userName: partner.user.name,
      userEmail: partner.user.email,
      status: this.mapStatus(partner.status),
      partnerApplicationId: partner.partnerApplicationId,
      minimumPayoutKopecks,
      effectiveMinimumPayoutKopecks:
        minimumPayoutKopecks ?? defaultMinimumPayoutKopecks,
      contractVersion: partner.contractVersion,
      createdAt: partner.createdAt.toISOString(),
      updatedAt: partner.updatedAt.toISOString(),
    };
  }

  private toPrismaStatus(status: AffiliatePartnerStatus) {
    switch (status) {
      case "active":
        return PrismaAffiliatePartnerStatus.ACTIVE;
      case "suspended":
        return PrismaAffiliatePartnerStatus.SUSPENDED;
    }
  }

  private mapStatus(
    status: PrismaAffiliatePartnerStatus,
  ): AffiliatePartnerStatus {
    switch (status) {
      case PrismaAffiliatePartnerStatus.ACTIVE:
        return "active";
      case PrismaAffiliatePartnerStatus.SUSPENDED:
        return "suspended";
    }
  }
}
