import { Type } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import { IsArray, ValidateNested } from "class-validator";

import { OzonDeliveryPointInfoDTO } from "./ozon-delivery-point-info.dto";

export class OzonDeliveryPointInfoResponseDTO {
  @ApiProperty({ type: [OzonDeliveryPointInfoDTO] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OzonDeliveryPointInfoDTO)
  points!: OzonDeliveryPointInfoDTO[];
}
