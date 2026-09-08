import { Type } from "class-transformer";
import { IsInt, IsPositive } from "class-validator";

export class GetCdekCityQueryDTO {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  cityCode!: number;
}
