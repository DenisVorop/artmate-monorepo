import { IsNotEmpty, IsNumber, IsString, Min } from "class-validator";

export class PickupPointDTO {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  address!: string;

  @IsString()
  @IsNotEmpty()
  workHours!: string;

  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  deliveryPrice!: number;
}
