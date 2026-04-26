import { Type } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import { IsDefined, ValidateNested } from "class-validator";

import { OzonCoordinateDTO } from "./ozon-coordinate.dto";

export class OzonDeliveryViewportDTO {
  @ApiProperty({
    description: "Left bottom map coordinate.",
    type: OzonCoordinateDTO,
  })
  @IsDefined()
  @ValidateNested()
  @Type(() => OzonCoordinateDTO)
  left_bottom!: OzonCoordinateDTO;

  @ApiProperty({
    description: "Right top map coordinate.",
    type: OzonCoordinateDTO,
  })
  @IsDefined()
  @ValidateNested()
  @Type(() => OzonCoordinateDTO)
  right_top!: OzonCoordinateDTO;
}
