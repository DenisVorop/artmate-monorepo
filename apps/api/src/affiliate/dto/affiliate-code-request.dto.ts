import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from "class-validator";

const trimOptionalString = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() || null : value;

export class CreateAffiliateCodeRequestDTO {
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @MinLength(3)
  @MaxLength(40)
  code?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(500)
  comment?: string | null;

  @IsInt()
  @Min(0)
  @Max(15)
  partnerPercent!: number;
}

export class UpdateAffiliateCodeRequestDTO {
  @ValidateIf(
    (object: UpdateAffiliateCodeRequestDTO, value) =>
      value !== null &&
      (value !== undefined ||
        (object.partnerPercent === undefined && object.isActive === undefined)),
  )
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(500)
  comment?: string | null;

  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(15)
  partnerPercent?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;
}
