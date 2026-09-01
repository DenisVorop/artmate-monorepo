import {
  Equals,
  IsEmail,
  IsISO8601,
  IsIn,
  IsOptional,
  IsString,
} from "class-validator";

import {
  partnerApplicationAudienceSizes,
  partnerApplicationPreferredContacts,
  partnerApplicationStatuses,
  partnerApplicationTypes,
  type PartnerApplicationAudienceSize,
  type PartnerApplicationPreferredContact,
  type PartnerApplicationStatus,
  type PartnerApplicationType,
} from "../partner-applications.types";

export class PartnerApplicationDTO {
  @IsString()
  id!: string;

  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsIn(partnerApplicationPreferredContacts)
  preferredContact!: PartnerApplicationPreferredContact;

  @IsOptional()
  @IsString()
  contactHandle?: string;

  @IsString()
  channelUrl!: string;

  @IsIn(partnerApplicationTypes)
  partnerType!: PartnerApplicationType;

  @IsIn(partnerApplicationAudienceSizes)
  audienceSize!: PartnerApplicationAudienceSize;

  @IsOptional()
  @IsString()
  comment?: string;

  @Equals(true)
  consent!: true;

  @IsOptional()
  @IsString()
  utmSource?: string;

  @IsOptional()
  @IsString()
  utmMedium?: string;

  @IsOptional()
  @IsString()
  utmCampaign?: string;

  @IsOptional()
  @IsString()
  utmContent?: string;

  @IsOptional()
  @IsString()
  utmTerm?: string;

  @IsIn(partnerApplicationStatuses)
  status!: PartnerApplicationStatus;

  @IsISO8601()
  createdAt!: string;

  @IsISO8601()
  updatedAt!: string;
}
