import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

import { CART_ITEM_MAX_QUANTITY } from "../cart.constants";

export class AddCartItemRequestDTO {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(CART_ITEM_MAX_QUANTITY)
  quantity?: number;
}
