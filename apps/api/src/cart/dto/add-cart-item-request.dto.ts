import { Type } from "class-transformer";
import {
  IsDefined,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

import { CART_ITEM_MAX_QUANTITY } from "../cart.constants";

import { CartProductDTO } from "./cart-product.dto";

export class AddCartItemRequestDTO {
  @IsDefined()
  @ValidateNested()
  @Type(() => CartProductDTO)
  product!: CartProductDTO;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(CART_ITEM_MAX_QUANTITY)
  quantity?: number;
}
