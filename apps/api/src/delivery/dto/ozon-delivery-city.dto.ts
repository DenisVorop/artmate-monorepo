import { IsNotEmpty, IsString, Length, MaxLength } from "class-validator";

export class OzonDeliveryCityDTO {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  region!: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 2)
  countryCode!: string;
}
