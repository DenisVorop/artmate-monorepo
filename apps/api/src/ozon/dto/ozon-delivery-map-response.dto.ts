import { Type } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import { IsArray, ValidateNested } from "class-validator";

import { OzonDeliveryMapClusterDTO } from "./ozon-delivery-map-cluster.dto";
import { OzonDeliveryMapPointDTO } from "./ozon-delivery-map-point.dto";

export class OzonDeliveryMapResponseDTO {
  @ApiProperty({ type: [OzonDeliveryMapClusterDTO] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OzonDeliveryMapClusterDTO)
  clusters!: OzonDeliveryMapClusterDTO[];

  @ApiProperty({ type: [OzonDeliveryMapPointDTO] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OzonDeliveryMapPointDTO)
  points!: OzonDeliveryMapPointDTO[];
}
