import { Type } from "class-transformer";
import { IsArray, IsInt, Min, ValidateNested } from "class-validator";

import { PartnerApplicationDTO } from "./partner-application.dto";

export class PartnerApplicationListDTO {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PartnerApplicationDTO)
  items!: PartnerApplicationDTO[];

  @IsInt()
  @Min(1)
  page!: number;

  @IsInt()
  @Min(1)
  pageSize!: number;

  @IsInt()
  @Min(0)
  total!: number;

  @IsInt()
  @Min(0)
  totalPages!: number;
}
