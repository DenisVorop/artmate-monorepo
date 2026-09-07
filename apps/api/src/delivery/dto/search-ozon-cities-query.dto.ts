import { IsString, MaxLength, MinLength } from "class-validator";

export class SearchOzonCitiesQueryDTO {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  query!: string;
}
