import { Type } from "class-transformer";
import { IsInt, IsOptional, IsPositive, IsString } from "class-validator";

export class SearchDeliveryPickupPointsQueryDTO {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  cityCode!: number;

  @IsOptional()
  @IsString()
  type?: string;
}
