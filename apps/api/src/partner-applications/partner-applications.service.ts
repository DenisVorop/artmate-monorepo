import { Injectable, Logger, NotFoundException } from "@nestjs/common";

import type { SiteActionAccessV1 } from "../auth/contracts/site-action-access.contract";

import { ContactsService } from "../contacts/contacts.service";
import {
  PartnerApplicationAudienceSize as PrismaPartnerApplicationAudienceSize,
  PartnerApplicationPreferredContact as PrismaPartnerApplicationPreferredContact,
  PartnerApplicationStatus as PrismaPartnerApplicationStatus,
  PartnerApplicationType as PrismaPartnerApplicationType,
  Prisma,
} from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";

import type {
  CreatePartnerApplicationRequestDTO,
  ListPartnerApplicationsQueryDTO,
  UpdatePartnerApplicationStatusRequestDTO,
} from "./dto";
import type {
  PartnerApplicationAudienceSize,
  PartnerApplicationPreferredContact,
  PartnerApplicationStatus,
  PartnerApplicationType,
} from "./partner-applications.types";

type StoredPartnerApplication = Prisma.PartnerApplicationGetPayload<object>;

const preferredContactLabels: Record<
  PartnerApplicationPreferredContact,
  string
> = {
  email: "Email",
  telegram: "Telegram",
};

const partnerTypeLabels: Record<PartnerApplicationType, string> = {
  creator: "Контент-креатор",
  artist: "Художник",
  educator: "Преподаватель",
  studio: "Студия",
  retailer: "Магазин",
  other: "Другое",
};

const audienceSizeLabels: Record<PartnerApplicationAudienceSize, string> = {
  up_to_1000: "до 1 000",
  "1000_10000": "1 000–10 000",
  "10000_50000": "10 000–50 000",
  "50000_plus": "более 50 000",
};

@Injectable()
export class PartnerApplicationsService {
  private readonly logger = new Logger(PartnerApplicationsService.name);

  constructor(
    private readonly contactsService: ContactsService,
    private readonly prisma: PrismaService,
  ) {}

  async createApplication(
    input: CreatePartnerApplicationRequestDTO,
    access: SiteActionAccessV1,
  ) {
    if (input.website?.trim()) {
      return { accepted: true as const };
    }

    const application = await this.prisma.partnerApplication.create({
      data: {
        name: input.name,
        email: input.email.toLowerCase(),
        preferredContact: this._toPrismaPreferredContact(
          input.preferredContact,
        ),
        contactHandle: input.contactHandle,
        channelUrl: input.channelUrl,
        partnerType: this._toPrismaPartnerType(input.partnerType),
        audienceSize: this._toPrismaAudienceSize(input.audienceSize),
        comment: input.comment,
        authenticatedUserId: access.actor.userId,
        consentAcceptanceId: access.requiredConsent.acceptanceId,
        utmSource: input.utmSource,
        utmMedium: input.utmMedium,
        utmCampaign: input.utmCampaign,
        utmContent: input.utmContent,
        utmTerm: input.utmTerm,
      },
    });

    await this._notifyAboutApplication(application);

    return { accepted: true as const };
  }

  async listApplications(query: ListPartnerApplicationsQueryDTO) {
    const where: Prisma.PartnerApplicationWhereInput = query.status
      ? { status: this._toPrismaStatus(query.status) }
      : {};
    const skip = (query.page - 1) * query.pageSize;
    const [applications, total] = await this.prisma.$transaction([
      this.prisma.partnerApplication.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take: query.pageSize,
      }),
      this.prisma.partnerApplication.count({ where }),
    ]);

    return {
      items: applications.map((application) =>
        this._mapApplication(application),
      ),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
    };
  }

  async updateStatus(
    applicationId: string,
    input: UpdatePartnerApplicationStatusRequestDTO,
  ) {
    try {
      const application = await this.prisma.partnerApplication.update({
        where: { id: applicationId },
        data: { status: this._toPrismaStatus(input.status) },
      });

      return this._mapApplication(application);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new NotFoundException("Partner application not found");
      }

      throw error;
    }
  }

  private async _notifyAboutApplication(application: StoredPartnerApplication) {
    try {
      await this.contactsService.enqueueTelegramNotification(
        this._formatTelegramMessage(application),
      );
    } catch (error) {
      this.logger.warn(
        `Partner application ${application.id} was saved, but Telegram notification enqueue failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private _formatTelegramMessage(application: StoredPartnerApplication) {
    const preferredContact = this._mapPreferredContact(
      application.preferredContact,
    );
    const utm = [
      application.utmSource && `source=${application.utmSource}`,
      application.utmMedium && `medium=${application.utmMedium}`,
      application.utmCampaign && `campaign=${application.utmCampaign}`,
      application.utmContent && `content=${application.utmContent}`,
      application.utmTerm && `term=${application.utmTerm}`,
    ]
      .filter((value): value is string => Boolean(value))
      .join(" · ");
    const lines = [
      "<b>Новая заявка в партнёрскую программу Artmate</b>",
      "",
      `<b>Имя:</b> ${this._formatTelegramText(application.name, 240)}`,
      `<b>Email:</b> <code>${this._formatTelegramText(application.email, 400)}</code>`,
      `<b>Связаться через:</b> ${preferredContactLabels[preferredContact]}`,
      application.contactHandle
        ? `<b>Контакт:</b> <code>${this._formatTelegramText(application.contactHandle, 240)}</code>`
        : undefined,
      `<b>Площадка:</b> ${this._formatTelegramText(application.channelUrl, 800)}`,
      `<b>Тип партнёра:</b> ${partnerTypeLabels[this._mapPartnerType(application.partnerType)]}`,
      `<b>Аудитория:</b> ${audienceSizeLabels[this._mapAudienceSize(application.audienceSize)]}`,
      ...(application.consentAcceptanceId
        ? [
            `<b>Согласие на обработку ПДн:</b> <code>${this._formatTelegramText(application.consentAcceptanceId, 128)}</code>`,
          ]
        : []),
      application.comment ? "" : undefined,
      application.comment ? "<b>Комментарий:</b>" : undefined,
      application.comment
        ? this._formatTelegramText(application.comment, 1_200)
        : undefined,
      utm ? "" : undefined,
      utm ? `<b>UTM:</b> ${this._formatTelegramText(utm, 600)}` : undefined,
      "",
      `<b>ID заявки:</b> <code>${this._formatTelegramText(application.id, 64)}</code>`,
    ].filter((line): line is string => typeof line === "string");

    return lines.join("\n");
  }

  private _mapApplication(application: StoredPartnerApplication) {
    return {
      id: application.id,
      name: application.name,
      email: application.email,
      preferredContact: this._mapPreferredContact(application.preferredContact),
      contactHandle: application.contactHandle ?? undefined,
      channelUrl: application.channelUrl,
      partnerType: this._mapPartnerType(application.partnerType),
      audienceSize: this._mapAudienceSize(application.audienceSize),
      comment: application.comment ?? undefined,
      consent: application.consent,
      authenticatedUserId: application.authenticatedUserId ?? undefined,
      consentAcceptanceId: application.consentAcceptanceId ?? undefined,
      utmSource: application.utmSource ?? undefined,
      utmMedium: application.utmMedium ?? undefined,
      utmCampaign: application.utmCampaign ?? undefined,
      utmContent: application.utmContent ?? undefined,
      utmTerm: application.utmTerm ?? undefined,
      status: this._mapStatus(application.status),
      createdAt: application.createdAt.toISOString(),
      updatedAt: application.updatedAt.toISOString(),
    };
  }

  private _toPrismaPreferredContact(value: PartnerApplicationPreferredContact) {
    switch (value) {
      case "email":
        return PrismaPartnerApplicationPreferredContact.EMAIL;
      case "telegram":
        return PrismaPartnerApplicationPreferredContact.TELEGRAM;
    }
  }

  private _mapPreferredContact(
    value: PrismaPartnerApplicationPreferredContact,
  ): PartnerApplicationPreferredContact {
    switch (value) {
      case PrismaPartnerApplicationPreferredContact.EMAIL:
        return "email";
      case PrismaPartnerApplicationPreferredContact.TELEGRAM:
        return "telegram";
    }
  }

  private _toPrismaPartnerType(value: PartnerApplicationType) {
    switch (value) {
      case "creator":
        return PrismaPartnerApplicationType.CREATOR;
      case "artist":
        return PrismaPartnerApplicationType.ARTIST;
      case "educator":
        return PrismaPartnerApplicationType.EDUCATOR;
      case "studio":
        return PrismaPartnerApplicationType.STUDIO;
      case "retailer":
        return PrismaPartnerApplicationType.RETAILER;
      case "other":
        return PrismaPartnerApplicationType.OTHER;
    }
  }

  private _mapPartnerType(
    value: PrismaPartnerApplicationType,
  ): PartnerApplicationType {
    switch (value) {
      case PrismaPartnerApplicationType.CREATOR:
        return "creator";
      case PrismaPartnerApplicationType.ARTIST:
        return "artist";
      case PrismaPartnerApplicationType.EDUCATOR:
        return "educator";
      case PrismaPartnerApplicationType.STUDIO:
        return "studio";
      case PrismaPartnerApplicationType.RETAILER:
        return "retailer";
      case PrismaPartnerApplicationType.OTHER:
        return "other";
    }
  }

  private _toPrismaAudienceSize(value: PartnerApplicationAudienceSize) {
    switch (value) {
      case "up_to_1000":
        return PrismaPartnerApplicationAudienceSize.UP_TO_1000;
      case "1000_10000":
        return PrismaPartnerApplicationAudienceSize.FROM_1000;
      case "10000_50000":
        return PrismaPartnerApplicationAudienceSize.FROM_10000;
      case "50000_plus":
        return PrismaPartnerApplicationAudienceSize.FROM_50000;
    }
  }

  private _mapAudienceSize(
    value: PrismaPartnerApplicationAudienceSize,
  ): PartnerApplicationAudienceSize {
    switch (value) {
      case PrismaPartnerApplicationAudienceSize.UP_TO_1000:
        return "up_to_1000";
      case PrismaPartnerApplicationAudienceSize.FROM_1000:
        return "1000_10000";
      case PrismaPartnerApplicationAudienceSize.FROM_10000:
        return "10000_50000";
      case PrismaPartnerApplicationAudienceSize.FROM_50000:
        return "50000_plus";
    }
  }

  private _toPrismaStatus(value: PartnerApplicationStatus) {
    switch (value) {
      case "new":
        return PrismaPartnerApplicationStatus.NEW;
      case "contacted":
        return PrismaPartnerApplicationStatus.CONTACTED;
      case "approved":
        return PrismaPartnerApplicationStatus.APPROVED;
      case "rejected":
        return PrismaPartnerApplicationStatus.REJECTED;
    }
  }

  private _mapStatus(
    value: PrismaPartnerApplicationStatus,
  ): PartnerApplicationStatus {
    switch (value) {
      case PrismaPartnerApplicationStatus.NEW:
        return "new";
      case PrismaPartnerApplicationStatus.CONTACTED:
        return "contacted";
      case PrismaPartnerApplicationStatus.APPROVED:
        return "approved";
      case PrismaPartnerApplicationStatus.REJECTED:
        return "rejected";
    }
  }

  private _normalizeTelegramText(value: string) {
    const withoutControlCharacters = Array.from(value.trim())
      .map((character) => {
        const codePoint = character.codePointAt(0) ?? 0;
        const isControlCharacter =
          codePoint <= 0x1f ||
          (codePoint >= 0x7f && codePoint <= 0x9f) ||
          (codePoint >= 0x202a && codePoint <= 0x202e) ||
          (codePoint >= 0x2066 && codePoint <= 0x2069);

        return isControlCharacter ? " " : character;
      })
      .join("");

    return withoutControlCharacters.replace(/\s+/gu, " ");
  }

  private _formatTelegramText(value: string, maxLength: number) {
    const normalized = this._normalizeTelegramText(value);
    const codePoints = Array.from(normalized);
    let escaped = "";

    for (const [index, codePoint] of codePoints.entries()) {
      const escapedCodePoint =
        codePoint === "&"
          ? "&amp;"
          : codePoint === "<"
            ? "&lt;"
            : codePoint === ">"
              ? "&gt;"
              : codePoint;
      const isLastCodePoint = index === codePoints.length - 1;
      const availableLength = maxLength - (isLastCodePoint ? 0 : 1);

      if (escaped.length + escapedCodePoint.length > availableLength) {
        return `${escaped}…`;
      }

      escaped += escapedCodePoint;
    }

    return escaped;
  }
}
