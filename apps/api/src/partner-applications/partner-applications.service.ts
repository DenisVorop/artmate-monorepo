import { Injectable, Logger, NotFoundException } from "@nestjs/common";

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

  async createApplication(input: CreatePartnerApplicationRequestDTO) {
    if (input.website?.trim()) {
      return { accepted: true as const };
    }

    const application = await this.prisma.partnerApplication.create({
      data: {
        name: input.name,
        email: input.email.toLowerCase(),
        preferredContact: this.toPrismaPreferredContact(input.preferredContact),
        contactHandle: input.contactHandle,
        channelUrl: input.channelUrl,
        partnerType: this.toPrismaPartnerType(input.partnerType),
        audienceSize: this.toPrismaAudienceSize(input.audienceSize),
        comment: input.comment,
        consent: input.consent,
        utmSource: input.utmSource,
        utmMedium: input.utmMedium,
        utmCampaign: input.utmCampaign,
        utmContent: input.utmContent,
        utmTerm: input.utmTerm,
      },
    });

    await this.notifyAboutApplication(application);

    return { accepted: true as const };
  }

  async listApplications(query: ListPartnerApplicationsQueryDTO) {
    const where: Prisma.PartnerApplicationWhereInput = query.status
      ? { status: this.toPrismaStatus(query.status) }
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
        this.mapApplication(application),
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
        data: { status: this.toPrismaStatus(input.status) },
      });

      return this.mapApplication(application);
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

  private async notifyAboutApplication(application: StoredPartnerApplication) {
    try {
      await this.contactsService.enqueueTelegramNotification(
        this.formatTelegramMessage(application),
      );
    } catch (error) {
      this.logger.warn(
        `Partner application ${application.id} was saved, but Telegram notification enqueue failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private formatTelegramMessage(application: StoredPartnerApplication) {
    const preferredContact = this.mapPreferredContact(
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
      `<b>Имя:</b> ${this.formatTelegramText(application.name, 240)}`,
      `<b>Email:</b> <code>${this.formatTelegramText(application.email, 400)}</code>`,
      `<b>Связаться через:</b> ${preferredContactLabels[preferredContact]}`,
      application.contactHandle
        ? `<b>Контакт:</b> <code>${this.formatTelegramText(application.contactHandle, 240)}</code>`
        : undefined,
      `<b>Площадка:</b> ${this.formatTelegramText(application.channelUrl, 800)}`,
      `<b>Тип партнёра:</b> ${partnerTypeLabels[this.mapPartnerType(application.partnerType)]}`,
      `<b>Аудитория:</b> ${audienceSizeLabels[this.mapAudienceSize(application.audienceSize)]}`,
      "<b>Согласие на обработку ПДн:</b> получено",
      application.comment ? "" : undefined,
      application.comment ? "<b>Комментарий:</b>" : undefined,
      application.comment
        ? this.formatTelegramText(application.comment, 1_200)
        : undefined,
      utm ? "" : undefined,
      utm ? `<b>UTM:</b> ${this.formatTelegramText(utm, 600)}` : undefined,
      "",
      `<b>ID заявки:</b> <code>${this.formatTelegramText(application.id, 64)}</code>`,
    ].filter((line): line is string => typeof line === "string");

    return lines.join("\n");
  }

  private mapApplication(application: StoredPartnerApplication) {
    return {
      id: application.id,
      name: application.name,
      email: application.email,
      preferredContact: this.mapPreferredContact(application.preferredContact),
      contactHandle: application.contactHandle ?? undefined,
      channelUrl: application.channelUrl,
      partnerType: this.mapPartnerType(application.partnerType),
      audienceSize: this.mapAudienceSize(application.audienceSize),
      comment: application.comment ?? undefined,
      consent: application.consent,
      utmSource: application.utmSource ?? undefined,
      utmMedium: application.utmMedium ?? undefined,
      utmCampaign: application.utmCampaign ?? undefined,
      utmContent: application.utmContent ?? undefined,
      utmTerm: application.utmTerm ?? undefined,
      status: this.mapStatus(application.status),
      createdAt: application.createdAt.toISOString(),
      updatedAt: application.updatedAt.toISOString(),
    };
  }

  private toPrismaPreferredContact(value: PartnerApplicationPreferredContact) {
    switch (value) {
      case "email":
        return PrismaPartnerApplicationPreferredContact.EMAIL;
      case "telegram":
        return PrismaPartnerApplicationPreferredContact.TELEGRAM;
    }
  }

  private mapPreferredContact(
    value: PrismaPartnerApplicationPreferredContact,
  ): PartnerApplicationPreferredContact {
    switch (value) {
      case PrismaPartnerApplicationPreferredContact.EMAIL:
        return "email";
      case PrismaPartnerApplicationPreferredContact.TELEGRAM:
        return "telegram";
    }
  }

  private toPrismaPartnerType(value: PartnerApplicationType) {
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

  private mapPartnerType(
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

  private toPrismaAudienceSize(value: PartnerApplicationAudienceSize) {
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

  private mapAudienceSize(
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

  private toPrismaStatus(value: PartnerApplicationStatus) {
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

  private mapStatus(
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

  private normalizeTelegramText(value: string) {
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

  private formatTelegramText(value: string, maxLength: number) {
    const normalized = this.normalizeTelegramText(value);
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
