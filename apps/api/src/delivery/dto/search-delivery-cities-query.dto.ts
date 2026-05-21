import { IsOptional, IsString, MinLength } from "class-validator";

export class SearchDeliveryCitiesQueryDTO {
  @IsString()
  @MinLength(2)
  query!: string;

  @IsOptional()
  @IsString()
  countryCode?: string;
}
