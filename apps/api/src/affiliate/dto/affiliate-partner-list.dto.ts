import { Type } from "class-transformer";
import { IsArray, IsInt, Min, ValidateNested } from "class-validator";

import { AffiliatePartnerSummaryDTO } from "./affiliate-partner.dto";

export class AffiliatePartnerListDTO {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AffiliatePartnerSummaryDTO)
  items!: AffiliatePartnerSummaryDTO[];

  @IsInt()
  @Min(0)
  total!: number;

  @IsInt()
  @Min(1)
  page!: number;

  @IsInt()
  @Min(1)
  pageSize!: number;
}
