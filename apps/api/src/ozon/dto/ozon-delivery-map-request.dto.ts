import { Type } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import { IsDefined, IsInt, Max, Min, ValidateNested } from "class-validator";

import { OzonDeliveryViewportDTO } from "./ozon-delivery-viewport.dto";

export class OzonDeliveryMapRequestDTO {
  @ApiProperty({
    description: "Visible map area for pickup point clusters.",
    example: {
      left_bottom: {
        lat: 55.55,
        long: 37.35,
      },
      right_top: {
        lat: 55.95,
        long: 37.85,
      },
    },
    type: OzonDeliveryViewportDTO,
  })
  @IsDefined()
  @ValidateNested()
  @Type(() => OzonDeliveryViewportDTO)
  viewport!: OzonDeliveryViewportDTO;

  @ApiProperty({
    description: "Map zoom level.",
    example: 11,
  })
  @IsInt()
  @Min(0)
  @Max(22)
  zoom!: number;
}
