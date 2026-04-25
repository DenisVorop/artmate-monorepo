import { IsInt, Max, Min } from "class-validator";

import { CART_ITEM_MAX_QUANTITY } from "../cart.constants";

export class UpdateCartItemRequestDTO {
  @IsInt()
  @Min(1)
  @Max(CART_ITEM_MAX_QUANTITY)
  quantity!: number;
}
