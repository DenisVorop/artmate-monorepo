import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import {
  FeatureBannerAudience as PrismaFeatureBannerAudience,
  FeatureBannerTone as PrismaFeatureBannerTone,
  Prisma,
} from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthUser } from "../auth/auth.types";

import type {
  CreateFeatureBannerRequestDTO,
  UpdateFeatureBannerRequestDTO,
} from "./dto";
import type {
  FeatureBannerAudience,
  FeatureBannerTone,
} from "./feature-banners.types";

type StoredFeatureBanner = Prisma.FeatureBannerGetPayload<object>;

@Injectable()
export class FeatureBannersService {
  constructor(private readonly prisma: PrismaService) {}

  async getVisibleBanners(user?: AuthUser | null) {
    const banners = await this.prisma.featureBanner.findMany({
      where: {
        archivedAt: null,
        enabled: true,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    const needsTelegramStatus = banners.some(
      (banner) =>
        banner.audience === PrismaFeatureBannerAudience.TELEGRAM_UNLINKED,
    );
    const hasTelegramAccount =
      user && needsTelegramStatus
        ? Boolean(
            await this.prisma.telegramAccount.findUnique({
              where: { userId: user.id },
              select: { id: true },
            }),
          )
        : false;

    return banners
      .filter((banner) =>
        this.isVisibleForAudience(banner.audience, Boolean(user), hasTelegramAccount),
      )
      .map((banner) => this.mapBanner(banner));
  }

  async getAdminBanners() {
    const banners = await this.prisma.featureBanner.findMany({
      orderBy: [{ archivedAt: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    });

    return banners.map((banner) => this.mapBanner(banner));
  }

  async createBanner(input: CreateFeatureBannerRequestDTO) {
    const data = this.getCreateData(input);

    try {
      const banner = await this.prisma.featureBanner.create({ data });

      return this.mapBanner(banner);
    } catch (error) {
      this.handleMutationError(error);
    }
  }

  async updateBanner(bannerId: string, input: UpdateFeatureBannerRequestDTO) {
    const data = this.getUpdateData(input);

    try {
      const banner = await this.prisma.featureBanner.update({
        where: { id: bannerId },
        data,
      });

      return this.mapBanner(banner);
    } catch (error) {
      this.handleMutationError(error);
    }
  }

  async archiveBanner(bannerId: string) {
    try {
      const banner = await this.prisma.featureBanner.update({
        where: { id: bannerId },
        data: {
          archivedAt: new Date(),
          enabled: false,
        },
      });

      return this.mapBanner(banner);
    } catch (error) {
      this.handleMutationError(error);
    }
  }

  private isVisibleForAudience(
    audience: PrismaFeatureBannerAudience,
    isAuthenticated: boolean,
    hasTelegramAccount: boolean,
  ) {
    switch (audience) {
      case PrismaFeatureBannerAudience.ALL:
        return true;
      case PrismaFeatureBannerAudience.AUTHENTICATED:
        return isAuthenticated;
      case PrismaFeatureBannerAudience.ANONYMOUS:
        return !isAuthenticated;
      case PrismaFeatureBannerAudience.TELEGRAM_UNLINKED:
        return isAuthenticated && !hasTelegramAccount;
    }
  }

  private getCreateData(input: CreateFeatureBannerRequestDTO) {
    const cta = this.normalizeCta(input.ctaLabel, input.ctaHref);

    return {
      slug: this.normalizeSlug(input.slug),
      title: this.normalizeRequiredString(input.title, "title"),
      description: this.normalizeRequiredString(input.description, "description"),
      ctaLabel: cta.label,
      ctaHref: cta.href,
      audience: this.toPrismaAudience(input.audience ?? "all"),
      tone: this.toPrismaTone(input.tone ?? "info"),
      enabled: input.enabled ?? false,
      sortOrder: input.sortOrder ?? 0,
    } satisfies Prisma.FeatureBannerCreateInput;
  }

  private getUpdateData(input: UpdateFeatureBannerRequestDTO) {
    const data: Prisma.FeatureBannerUpdateInput = {};

    if (input.slug !== undefined) {
      data.slug = this.normalizeSlug(input.slug);
    }

    if (input.title !== undefined) {
      data.title = this.normalizeRequiredString(input.title, "title");
    }

    if (input.description !== undefined) {
      data.description = this.normalizeRequiredString(
        input.description,
        "description",
      );
    }

    if (input.ctaLabel !== undefined || input.ctaHref !== undefined) {
      const cta = this.normalizeCta(input.ctaLabel, input.ctaHref);
      data.ctaLabel = cta.label;
      data.ctaHref = cta.href;
    }

    if (input.audience !== undefined) {
      data.audience = this.toPrismaAudience(input.audience);
    }

    if (input.tone !== undefined) {
      data.tone = this.toPrismaTone(input.tone);
    }

    if (input.enabled !== undefined) {
      data.enabled = input.enabled;
    }

    if (input.sortOrder !== undefined) {
      data.sortOrder = input.sortOrder;
    }

    return data;
  }

  private normalizeCta(
    label: string | null | undefined,
    href: string | null | undefined,
  ) {
    const normalizedLabel = this.normalizeOptionalString(label);
    const normalizedHref = this.normalizeOptionalString(href);

    if ((normalizedLabel && !normalizedHref) || (!normalizedLabel && normalizedHref)) {
      throw new BadRequestException("CTA label and href must be provided together");
    }

    return {
      href: normalizedHref,
      label: normalizedLabel,
    };
  }

  private normalizeRequiredString(value: string, fieldName: string) {
    const normalized = value.trim();

    if (!normalized) {
      throw new BadRequestException(`${fieldName} is required`);
    }

    return normalized;
  }

  private normalizeOptionalString(value: string | null | undefined) {
    if (value === null) {
      return null;
    }

    if (value === undefined) {
      return undefined;
    }

    const normalized = value.trim();

    return normalized || null;
  }

  private normalizeSlug(value: string) {
    const slug = value.trim().toLowerCase();

    if (!/^[a-z0-9][a-z0-9-]{1,118}[a-z0-9]$/.test(slug)) {
      throw new BadRequestException(
        "slug must contain lowercase latin letters, numbers and hyphens",
      );
    }

    return slug;
  }

  private toPrismaAudience(audience: FeatureBannerAudience) {
    switch (audience) {
      case "all":
        return PrismaFeatureBannerAudience.ALL;
      case "authenticated":
        return PrismaFeatureBannerAudience.AUTHENTICATED;
      case "anonymous":
        return PrismaFeatureBannerAudience.ANONYMOUS;
      case "telegram_unlinked":
        return PrismaFeatureBannerAudience.TELEGRAM_UNLINKED;
    }
  }

  private toPrismaTone(tone: FeatureBannerTone) {
    switch (tone) {
      case "info":
        return PrismaFeatureBannerTone.INFO;
      case "success":
        return PrismaFeatureBannerTone.SUCCESS;
      case "warning":
        return PrismaFeatureBannerTone.WARNING;
    }
  }

  private mapAudience(audience: PrismaFeatureBannerAudience): FeatureBannerAudience {
    switch (audience) {
      case PrismaFeatureBannerAudience.ALL:
        return "all";
      case PrismaFeatureBannerAudience.AUTHENTICATED:
        return "authenticated";
      case PrismaFeatureBannerAudience.ANONYMOUS:
        return "anonymous";
      case PrismaFeatureBannerAudience.TELEGRAM_UNLINKED:
        return "telegram_unlinked";
    }
  }

  private mapTone(tone: PrismaFeatureBannerTone): FeatureBannerTone {
    switch (tone) {
      case PrismaFeatureBannerTone.INFO:
        return "info";
      case PrismaFeatureBannerTone.SUCCESS:
        return "success";
      case PrismaFeatureBannerTone.WARNING:
        return "warning";
    }
  }

  private mapBanner(banner: StoredFeatureBanner) {
    return {
      id: banner.id,
      slug: banner.slug,
      title: banner.title,
      description: banner.description,
      ...(banner.ctaLabel ? { ctaLabel: banner.ctaLabel } : {}),
      ...(banner.ctaHref ? { ctaHref: banner.ctaHref } : {}),
      audience: this.mapAudience(banner.audience),
      tone: this.mapTone(banner.tone),
      enabled: banner.enabled,
      sortOrder: banner.sortOrder,
      ...(banner.archivedAt ? { archivedAt: banner.archivedAt.toISOString() } : {}),
      createdAt: banner.createdAt.toISOString(),
      updatedAt: banner.updatedAt.toISOString(),
    };
  }

  private handleMutationError(error: unknown): never {
    if (error instanceof NotFoundException || error instanceof BadRequestException) {
      throw error;
    }

    if (this.isPrismaKnownError(error, "P2025")) {
      throw new NotFoundException("Feature banner not found");
    }

    if (this.isPrismaKnownError(error, "P2002")) {
      throw new ConflictException("Feature banner slug already exists");
    }

    throw error;
  }

  private isPrismaKnownError(error: unknown, code: string) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === code
    );
  }
}
