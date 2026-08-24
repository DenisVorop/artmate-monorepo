import { Type } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

import { deliveryPickupPointIdMaxLength } from "../../delivery/delivery.constants";

import { OzonCoordinateDTO } from "./ozon-coordinate.dto";

export class OzonDeliveryMapClusterDTO {
  @ApiProperty({ example: "mock-msk-center" })
  @IsString()
  @IsNotEmpty()
  cluster_id!: string;

  @ApiProperty({ type: OzonCoordinateDTO })
  @ValidateNested()
  @Type(() => OzonCoordinateDTO)
  coordinate!: OzonCoordinateDTO;

  @ApiProperty({ example: 3 })
  @IsInt()
  @Min(1)
  count!: number;

  @ApiProperty({ example: ["100101", "100102"], isArray: true, type: String })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(deliveryPickupPointIdMaxLength, { each: true })
  map_point_ids!: string[];
}
