import { Type } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";

import { deliveryPickupPointIdMaxLength } from "../../delivery/delivery.constants";

import { OzonCoordinateDTO } from "./ozon-coordinate.dto";

export class OzonDeliveryMapPointDTO {
  @ApiProperty({ example: "100101" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(deliveryPickupPointIdMaxLength)
  map_point_id!: string;

  @ApiProperty({ type: OzonCoordinateDTO })
  @ValidateNested()
  @Type(() => OzonCoordinateDTO)
  coordinate!: OzonCoordinateDTO;

  @ApiProperty({ example: "PVZ", enum: ["PVZ", "POSTAMAT"] })
  @IsIn(["PVZ", "POSTAMAT"])
  type!: "PVZ" | "POSTAMAT";

  @ApiProperty({
    example: "available",
    enum: ["available", "temporarily_unavailable"],
  })
  @IsIn(["available", "temporarily_unavailable"])
  status!: "available" | "temporarily_unavailable";

  @ApiProperty({ example: true })
  @IsBoolean()
  available!: boolean;
}
