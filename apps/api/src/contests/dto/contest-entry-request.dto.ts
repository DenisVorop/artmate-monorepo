import { Transform } from "class-transformer";
import {
  Equals,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";
import { ContestEntryStatus } from "../../generated/prisma/client";

const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;
export class SubmitContestEntryDTO {
  @IsString()
  @Matches(/^[0-9a-f]{32}$/)
  consentOfferId!: string;
  @Equals(true)
  personalDataAccepted!: boolean;
  @Equals(true)
  publicationAccepted!: boolean;
  @IsString()
  @Matches(/^[a-zA-Z0-9]{1,32}$/)
  albumId!: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(99)
  number?: number;
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  caption!: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(1)
  version?: number;
}
export class ContestEntryDecisionDTO {
  @IsEnum(ContestEntryStatus)
  status!: ContestEntryStatus;
  @IsInt()
  @Min(1)
  version!: number;
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
