import { ApiProperty } from "@nestjs/swagger";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, Min } from "class-validator";

export class OzonDeliveryPointInfoRequestDTO {
  @ApiProperty({
    description:
      "Pickup point map IDs from delivery map cluster map_point_ids array.",
    example: [123456789],
    isArray: true,
    type: Number,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsInt({ each: true })
  @Min(1, { each: true })
  map_point_ids!: number[];
}
