import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import {
  IsInt,
  IsISO8601,
  Max,
  Min,
  ValidateIf,
} from "class-validator";

import { CreateColoringRequestDTO } from "./create-coloring-request.dto";

export class UpdateColoringRequestDTO extends PartialType(
  CreateColoringRequestDTO,
  { skipNullProperties: false },
) {
  @ApiPropertyOptional({ type: "integer", minimum: 1, maximum: 99 })
  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(99)
  number?: number;

  @ApiProperty({ format: "date-time" })
  @IsISO8601()
  updatedAt!: string;
}
