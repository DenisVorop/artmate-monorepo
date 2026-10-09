import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { MaterialKind } from "../../generated/prisma/enums";

const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

export class PreviewMaterialImportRequestDTO {
  @ApiProperty({ maxLength: 160 })
  @Transform(trim)
  @IsString()
  @MaxLength(160)
  @Matches(/\S/, { message: "Укажите название набора." })
  title!: string;

  @ApiProperty({ maxLength: 160, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" })
  @Transform(trim)
  @IsString()
  @MaxLength(160)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      "В адресе набора допустимы латинские строчные буквы, цифры и дефисы.",
  })
  slug!: string;

  @ApiProperty({ maxLength: 120 })
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  @Matches(/\S/, { message: "Укажите бренд." })
  brand!: string;

  @ApiPropertyOptional({ maxLength: 120, nullable: true })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  line?: string | null;

  @ApiProperty({ enum: MaterialKind })
  @IsEnum(MaterialKind)
  kind!: MaterialKind;

  @ApiProperty({
    maxLength: 50000,
    description:
      "UTF-8 CSV, at most 50000 bytes; code,hex required; name,pantone optional.",
  })
  @IsString()
  @MinLength(1)
  @MaxLength(50000)
  source!: string;
}

export class ImportMaterialSetRequestDTO extends PreviewMaterialImportRequestDTO {
  @ApiProperty({ pattern: "^[a-f0-9]{64}$" })
  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  confirmationHash!: string;
}

export class MaterialImportColorDTO {
  @ApiProperty()
  @IsString()
  code!: string;

  @ApiProperty()
  @IsString()
  @Matches(/^#[0-9A-F]{6}$/)
  hex!: string;

  @ApiProperty({ nullable: true, type: String })
  @IsOptional()
  @IsString()
  name!: string | null;

  @ApiProperty({ nullable: true, type: String })
  @IsOptional()
  @IsString()
  pantone!: string | null;

  @ApiProperty()
  @IsInt()
  @Min(0)
  position!: number;
}

export class MaterialImportIssueDTO {
  @ApiProperty({ nullable: true, type: Number })
  @IsOptional()
  @IsInt()
  @Min(1)
  row!: number | null;

  @ApiProperty()
  @IsString()
  field!: string;

  @ApiProperty()
  @IsString()
  message!: string;

  @ApiProperty({ enum: ["error", "warning"] })
  @IsIn(["error", "warning"])
  severity!: "error" | "warning";
}

export class MaterialImportPreviewDTO {
  @ApiProperty()
  @IsBoolean()
  canImport!: boolean;

  @ApiProperty()
  @IsString()
  confirmationHash!: string;

  @ApiProperty({ type: [MaterialImportColorDTO] })
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => MaterialImportColorDTO)
  colors!: MaterialImportColorDTO[];

  @ApiProperty({ type: [MaterialImportIssueDTO] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MaterialImportIssueDTO)
  issues!: MaterialImportIssueDTO[];
}

export class MaterialSetSummaryDTO {
  @ApiProperty()
  @IsString()
  id!: string;

  @ApiProperty()
  @IsString()
  slug!: string;

  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty()
  @IsString()
  brand!: string;

  @ApiProperty({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  line!: string | null;

  @ApiProperty({ enum: MaterialKind })
  @IsEnum(MaterialKind)
  kind!: MaterialKind;

  @ApiProperty()
  @IsInt()
  @Min(0)
  colorCount!: number;

  @ApiProperty()
  @IsBoolean()
  isArchived!: boolean;
}

export class MaterialColorDTO extends MaterialImportColorDTO {
  @ApiProperty()
  @IsString()
  id!: string;
}

export class MaterialSetDetailDTO extends MaterialSetSummaryDTO {
  @ApiProperty({ type: [MaterialColorDTO] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MaterialColorDTO)
  colors!: MaterialColorDTO[];
}
