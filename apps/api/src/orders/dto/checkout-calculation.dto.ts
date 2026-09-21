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
  Max,
  Matches,
  ValidateNested,
} from "class-validator";

import { OrderDeliveryDTO } from "./order-delivery.dto";

export class CheckoutDeliveryDateRangeDTO {
  @IsDateString()
  min!: string;

  @IsDateString()
  max!: string;
}

export class CheckoutLoyaltyDTO {
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  expectedEarnedPoints!: number;

  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  availablePoints!: number;

  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  maxPoints!: number;

  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  pointsToSpend!: number;

  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  discountKopecks!: number;

  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  pricingRevision!: string;
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
  discount!: number;

  @IsOptional()
  @IsString()
  promoCode!: string | null;

  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  deliveryPrice!: number;

  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  total!: number;

  @IsDefined()
  @ValidateNested()
  @Type(() => CheckoutLoyaltyDTO)
  loyalty!: CheckoutLoyaltyDTO;

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
