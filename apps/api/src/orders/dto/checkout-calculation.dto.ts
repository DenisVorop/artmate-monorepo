import { Type } from "class-transformer";
import {
  IsDateString,
  IsDefined,
  IsIn,
  IsInt,
  IsOptional,
  IsNotEmpty,
  IsNumber,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";

import { OrderDeliveryDTO } from "./order-delivery.dto";

export class CheckoutDeliveryDateRangeDTO {
  @IsDateString()
  min!: string;

  @IsDateString()
  max!: string;
}

export class CheckoutCalculationDTO {
  @IsString()
  @IsNotEmpty()
  cartId!: string;

  @IsInt()
  @Min(0)
  itemsCount!: number;

  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  subtotal!: number;

  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  deliveryPrice!: number;

  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  total!: number;

  @IsIn(["RUB"])
  currency!: "RUB";

  @IsDefined()
  @ValidateNested()
  @Type(() => OrderDeliveryDTO)
  delivery!: OrderDeliveryDTO;

  @IsOptional()
  @ValidateNested()
  @Type(() => CheckoutDeliveryDateRangeDTO)
  estimatedDeliveryDateRange?: CheckoutDeliveryDateRangeDTO;
}
