import { Transform } from "class-transformer";
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";

import {
  partnerApplicationChannelUrlMaxLength,
  partnerApplicationCommentMaxLength,
  partnerApplicationContactHandleMaxLength,
  partnerApplicationEmailMaxLength,
  partnerApplicationHoneypotMaxLength,
  partnerApplicationNameMaxLength,
  partnerApplicationUtmMaxLength,
} from "../partner-applications.constants";
import {
  partnerApplicationAudienceSizes,
  partnerApplicationPreferredContacts,
  partnerApplicationTypes,
  type PartnerApplicationAudienceSize,
  type PartnerApplicationPreferredContact,
  type PartnerApplicationType,
} from "../partner-applications.types";
import { normalizeTelegramContact } from "../telegram-contact";

const Trim = () =>
  Transform(({ value }) => (typeof value === "string" ? value.trim() : value));

const OptionalTrim = () =>
  Transform(({ value }) => {
    if (typeof value !== "string") return value;

    return value.trim() || undefined;
  });

const NormalizeTelegramContact = () =>
  Transform(({ value }) => {
    if (typeof value !== "string") return value;

    const trimmedValue = value.trim();

    if (!trimmedValue) return undefined;

    return normalizeTelegramContact(trimmedValue) ?? trimmedValue;
  });

export class CreatePartnerApplicationRequestDTO {
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(partnerApplicationNameMaxLength)
  name!: string;

  @Trim()
  @IsEmail()
  @MaxLength(partnerApplicationEmailMaxLength)
  email!: string;

  @IsIn(partnerApplicationPreferredContacts)
  preferredContact!: PartnerApplicationPreferredContact;

  @NormalizeTelegramContact()
  @ValidateIf(
    (request: CreatePartnerApplicationRequestDTO) =>
      request.preferredContact === "telegram" ||
      request.contactHandle !== undefined,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(partnerApplicationContactHandleMaxLength)
  @Matches(/^@[a-zA-Z0-9_]{5,32}$/, {
    message: "contactHandle must be a valid Telegram username",
  })
  contactHandle?: string;

  @Trim()
  @IsUrl({ protocols: ["http", "https"], require_protocol: true })
  @MaxLength(partnerApplicationChannelUrlMaxLength)
  channelUrl!: string;

  @IsIn(partnerApplicationTypes)
  partnerType!: PartnerApplicationType;

  @IsIn(partnerApplicationAudienceSizes)
  audienceSize!: PartnerApplicationAudienceSize;

  @OptionalTrim()
  @IsOptional()
  @IsString()
  @MaxLength(partnerApplicationCommentMaxLength)
  comment?: string;

  @IsBoolean()
  @Equals(true)
  consent!: true;

  @OptionalTrim()
  @IsOptional()
  @IsString()
  @MaxLength(partnerApplicationUtmMaxLength)
  utmSource?: string;

  @OptionalTrim()
  @IsOptional()
  @IsString()
  @MaxLength(partnerApplicationUtmMaxLength)
  utmMedium?: string;

  @OptionalTrim()
  @IsOptional()
  @IsString()
  @MaxLength(partnerApplicationUtmMaxLength)
  utmCampaign?: string;

  @OptionalTrim()
  @IsOptional()
  @IsString()
  @MaxLength(partnerApplicationUtmMaxLength)
  utmContent?: string;

  @OptionalTrim()
  @IsOptional()
  @IsString()
  @MaxLength(partnerApplicationUtmMaxLength)
  utmTerm?: string;

  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(partnerApplicationHoneypotMaxLength)
  website?: string;
}
