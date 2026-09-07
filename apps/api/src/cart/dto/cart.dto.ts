import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";

import { CartItemDTO } from "./cart-item.dto";

class CartMinimumDeliveryPricesDTO {
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  ozon!: number;
}

export class CartDTO {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemDTO)
  items!: CartItemDTO[];

  @IsInt()
  @Min(0)
  itemsCount!: number;

  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  subtotal!: number;

  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  total!: number;

  @IsIn(["RUB"])
  currency!: "RUB";

  @IsBoolean()
  isOzonDeliveryAvailable!: boolean;

  @ValidateNested()
  @Type(() => CartMinimumDeliveryPricesDTO)
  minimumDeliveryPrices!: CartMinimumDeliveryPricesDTO;
}
