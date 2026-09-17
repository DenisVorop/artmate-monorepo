import { Transform, type TransformFnParams } from "class-transformer";
import { IsDefined, IsIn, IsInt, Max, Min } from "class-validator";

const maxSignedInteger = 2_147_483_647;

export class AffiliateAnalyticsQueryDTO {
  @IsDefined()
  @Transform(toStrictQueryInteger)
  @IsInt()
  @IsIn([7, 30, 90])
  days: 7 | 30 | 90 = 30;

  @IsDefined()
  @Transform(toStrictQueryInteger)
  @IsInt()
  @Min(1)
  @Max(maxSignedInteger)
  codePage = 1;

  @IsDefined()
  @Transform(toStrictQueryInteger)
  @IsInt()
  @Min(1)
  @Max(50)
  codePageSize = 10;
}

export class AffiliateLedgerQueryDTO {
  @IsDefined()
  @Transform(toStrictQueryInteger)
  @IsInt()
  @IsIn([7, 30, 90])
  days: 7 | 30 | 90 = 30;

  @IsDefined()
  @Transform(toStrictQueryInteger)
  @IsInt()
  @Min(1)
  @Max(maxSignedInteger)
  page = 1;

  @IsDefined()
  @Transform(toStrictQueryInteger)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize = 20;
}

function toStrictQueryInteger({ value }: TransformFnParams) {
  return typeof value === "string" && /^\d+$/.test(value)
    ? Number(value)
    : value;
}
