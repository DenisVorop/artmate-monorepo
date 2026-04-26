import { Type } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";

import { OzonCoordinateDTO } from "./ozon-coordinate.dto";
import { OzonDeliveryPointRestrictionsDTO } from "./ozon-delivery-point-restrictions.dto";

export class OzonDeliveryPointInfoDTO {
  @ApiProperty({ example: 100101 })
  @IsInt()
  @Min(1)
  map_point_id!: number;

  @ApiProperty({ example: "ozon-tverskaya-12" })
  @IsString()
  @IsNotEmpty()
  external_id!: string;

  @ApiProperty({ example: "Ozon ПВЗ, Тверская" })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: "PVZ", enum: ["PVZ", "POSTAMAT"] })
  @IsIn(["PVZ", "POSTAMAT"])
  type!: "PVZ" | "POSTAMAT";

  @ApiProperty({ example: "Москва, ул. Тверская, 12с1" })
  @IsString()
  @IsNotEmpty()
  address!: string;

  @ApiProperty({ example: "Москва" })
  @IsString()
  @IsNotEmpty()
  city!: string;

  @ApiProperty({ type: OzonCoordinateDTO })
  @ValidateNested()
  @Type(() => OzonCoordinateDTO)
  coordinate!: OzonCoordinateDTO;

  @ApiProperty({
    example: "available",
    enum: ["available", "temporarily_unavailable"],
  })
  @IsIn(["available", "temporarily_unavailable"])
  status!: "available" | "temporarily_unavailable";

  @ApiProperty({ example: true })
  @IsBoolean()
  available!: boolean;

  @ApiProperty({ example: "Ежедневно 09:00-22:00" })
  @IsString()
  @IsNotEmpty()
  work_hours!: string;

  @ApiProperty({ example: 350 })
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  delivery_price!: number;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  delivery_term_days!: number;

  @ApiProperty({ type: OzonDeliveryPointRestrictionsDTO })
  @ValidateNested()
  @Type(() => OzonDeliveryPointRestrictionsDTO)
  restrictions!: OzonDeliveryPointRestrictionsDTO;

  @ApiProperty({ example: ["pickup", "partial_return"], type: [String] })
  @IsArray()
  @IsString({ each: true })
  available_delivery_methods!: string[];

  @ApiProperty({ example: ["online_card"], type: [String] })
  @IsArray()
  @IsString({ each: true })
  payment_methods!: string[];

  @ApiProperty({
    example: "Вход со стороны Тверской улицы, ПВЗ на первом этаже.",
  })
  @IsString()
  @IsNotEmpty()
  how_to_get!: string;
}
