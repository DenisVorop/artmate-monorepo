import { IsInt, IsNumber, Min } from "class-validator";

export class AdminOrderDiscountDTO {
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  promoDiscount!: number;

  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  loyaltyDiscount!: number;

  @IsInt()
  @Min(0)
  loyaltyPoints!: number;
}
