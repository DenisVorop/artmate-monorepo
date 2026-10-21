import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

class ConsentDecisionDTO {
  @IsString() @MaxLength(128) revisionId!: string;
  @IsBoolean() accepted!: boolean;
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
}
