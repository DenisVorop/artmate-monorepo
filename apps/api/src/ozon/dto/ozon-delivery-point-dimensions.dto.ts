import { ApiProperty } from "@nestjs/swagger";
import { IsInt, Min } from "class-validator";

export class OzonDeliveryPointDimensionsDTO {
  @ApiProperty({ example: 60 })
  @IsInt()
  @Min(1)
  width!: number;

  @ApiProperty({ example: 60 })
  @IsInt()
  @Min(1)
  height!: number;

  @ApiProperty({ example: 80 })
  @IsInt()
  @Min(1)
  depth!: number;
}
