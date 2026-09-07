import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class SearchOzonPickupPointsQueryDTO {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  localityId!: string;
}
