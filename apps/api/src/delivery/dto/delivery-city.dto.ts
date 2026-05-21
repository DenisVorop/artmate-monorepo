import { IsInt, IsNotEmpty, IsString } from "class-validator";

export class DeliveryCityDTO {
  @IsInt()
  code!: number;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  countryCode!: string;
}
