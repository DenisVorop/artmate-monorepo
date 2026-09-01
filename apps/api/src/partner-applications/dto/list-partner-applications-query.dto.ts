import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";

import {
  partnerApplicationStatuses,
  type PartnerApplicationStatus,
} from "../partner-applications.types";

export class ListPartnerApplicationsQueryDTO {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @IsOptional()
  @IsIn(partnerApplicationStatuses)
  status?: PartnerApplicationStatus;
}
