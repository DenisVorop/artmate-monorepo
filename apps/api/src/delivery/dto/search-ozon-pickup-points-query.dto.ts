import { Type } from "class-transformer";
import { IsInt, Min } from "class-validator";

export class SearchOzonPickupPointsQueryDTO {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cityCode!: number;
}
