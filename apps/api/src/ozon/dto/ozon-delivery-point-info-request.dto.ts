import { ApiProperty } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsString,
  MaxLength,
} from "class-validator";

import { deliveryPickupPointIdMaxLength } from "../../delivery/delivery.constants";

export class OzonDeliveryPointInfoRequestDTO {
  @ApiProperty({
    description:
      "Pickup point map IDs from delivery map cluster map_point_ids array.",
    example: ["123456789"],
    isArray: true,
    type: String,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(deliveryPickupPointIdMaxLength, { each: true })
  map_point_ids!: string[];
}
