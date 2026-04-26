import { Type } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsInt, Min, ValidateNested } from "class-validator";

import { OzonCoordinateDTO } from "./ozon-coordinate.dto";

export class OzonDeliveryMapPointDTO {
  @ApiProperty({ example: 100101 })
  @IsInt()
  @Min(1)
  map_point_id!: number;

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
