import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

import {
  deliveryPickupPointIdMaxLength,
  deliveryPickupPointTitleMaxLength,
  deliveryPickupPointWorkHoursMaxLength,
} from "../../delivery/delivery.constants";

export class PickupPointDTO {
  @IsString()
  @IsNotEmpty()
  @MaxLength(deliveryPickupPointIdMaxLength)
  id!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(deliveryPickupPointTitleMaxLength)
  title!: string;

  @IsString()
  @IsNotEmpty()
  address!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(deliveryPickupPointWorkHoursMaxLength)
  workHours!: string;

  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  deliveryPrice!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  cityCode?: number;

  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(-180)
  @Max(180)
  longitude?: number;
}
