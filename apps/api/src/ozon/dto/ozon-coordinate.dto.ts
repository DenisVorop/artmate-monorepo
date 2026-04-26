import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, Max, Min } from "class-validator";

export class OzonCoordinateDTO {
  @ApiProperty({
    description: "Latitude.",
    example: 55.55,
  })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @ApiProperty({
    description: "Longitude.",
    example: 37.35,
  })
  @IsNumber()
  @Min(-180)
  @Max(180)
  long!: number;
}
