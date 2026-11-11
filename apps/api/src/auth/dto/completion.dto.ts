import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

class ConsentDecisionDTO {
  @IsString() @MaxLength(128) revisionId!: string;
  @IsBoolean() accepted!: boolean;
}

class BrowserVersionDTO {
  @IsString() @Matches(/^[\w .-]{1,48}$/) brand!: string;
  @IsString() @MaxLength(32) @Matches(/^\d+(?:\.\d+){0,5}$/) version!: string;
}

class AdvertisingConsentDeviceDTO {
  @IsOptional() @IsString() @Matches(/^[\w+/-]{1,64}$/) timeZone?: string;
  @IsOptional() @IsInt() @Min(-840) @Max(840) utcOffsetMinutes?: number;
  @IsOptional()
  @IsString()
  @MaxLength(32)
  @Matches(/^\d+(?:\.\d+){0,5}$/)
  platformVersion?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => BrowserVersionDTO)
  browserVersions?: BrowserVersionDTO[];
}

export class CompleteAuthFlowDTO {
  @IsString() @Matches(/^[a-zA-Z0-9_-]{1,64}$/) operationKey!: string;
  @IsInt() @Min(0) expectedStateRevision!: number;
  @IsInt() @Min(0) expectedAdvertisingVersion!: number;
  @IsArray()
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => ConsentDecisionDTO)
  decisions!: ConsentDecisionDTO[];
  @IsOptional() @IsString() @MaxLength(255) source?: string;
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AdvertisingConsentDeviceDTO)
  advertisingDevice?: AdvertisingConsentDeviceDTO;
}
