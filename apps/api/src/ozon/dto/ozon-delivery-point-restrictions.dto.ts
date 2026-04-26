import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";

import { OzonDeliveryPointDimensionsDTO } from "./ozon-delivery-point-dimensions.dto";

export class OzonDeliveryPointRestrictionsDTO {
  @ApiProperty({ example: 15000 })
  @IsInt()
  @Min(1)
  max_weight_g!: number;

  @ApiProperty({ type: OzonDeliveryPointDimensionsDTO })
  @ValidateNested()
  @Type(() => OzonDeliveryPointDimensionsDTO)
  max_dimensions_cm!: OzonDeliveryPointDimensionsDTO;

  @ApiProperty({
    example: ["Проверка заказа при получении", "Возврат частями доступен"],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  notes!: string[];

  @ApiPropertyOptional({
    example: "Временно недоступен из-за обслуживания постамата",
  })
  @IsOptional()
  @IsString()
  unavailable_reason?: string;
}
