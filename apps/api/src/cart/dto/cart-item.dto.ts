import { IsInt, IsNumber, Max, Min } from "class-validator";

import { CART_ITEM_MAX_QUANTITY } from "../cart.constants";

import { CartProductDTO } from "./cart-product.dto";

export class CartItemDTO extends CartProductDTO {
  @IsInt()
  @Min(1)
  @Max(CART_ITEM_MAX_QUANTITY)
  quantity!: number;

  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  lineTotal!: number;
}
