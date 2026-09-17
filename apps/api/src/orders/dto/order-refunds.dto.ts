import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";

export class RefundPriceGroupDTO {
  @IsInt()
  @Min(0)
  unitPriceKopecks!: number;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class OrderRefundableItemDTO {
  @IsString()
  productId!: string;

  @IsString()
  title!: string;

  @IsInt()
  @Min(0)
  quantity!: number;

  @IsInt()
  @Min(0)
  returnedQuantity!: number;

  @IsInt()
  @Min(0)
  remainingQuantity!: number;

  @IsInt()
  @Min(0)
  refundableKopecks!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RefundPriceGroupDTO)
  remainingPriceGroups!: RefundPriceGroupDTO[];
}

export class OrderRefundDeliveryDTO {
  @IsInt()
  @Min(0)
  paidKopecks!: number;

  @IsInt()
  @Min(0)
  returnedKopecks!: number;

  @IsInt()
  @Min(0)
  refundableKopecks!: number;
}

export class OrderRefundCommissionDTO {
  @IsInt()
  @Min(0)
  partnerPercent!: number;

  @IsInt()
  @Min(0)
  buyerPercent!: number;

  @IsBoolean()
  isSelfPurchase!: boolean;

  @IsInt()
  @Min(0)
  earnedKopecks!: number;

  @IsInt()
  @Min(0)
  reversedKopecks!: number;

  @IsInt()
  @Min(0)
  remainingKopecks!: number;

  @IsOptional()
  @IsISO8601()
  completedAt!: string | null;

  @IsOptional()
  @IsISO8601()
  availableAt!: string | null;

  @IsIn(["pending", "available", "held", "reversed", "not_earned"])
  status!: "pending" | "available" | "held" | "reversed" | "not_earned";
}

export class OrderRefundAuthorDTO {
  @IsString()
  id!: string;

  @IsOptional()
  @IsString()
  name!: string | null;
}

export class OrderRefundItemDTO {
  @IsString()
  productId!: string;

  @IsString()
  title!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsInt()
  @Min(0)
  amountKopecks!: number;
}

export class OrderRefundDTO {
  @IsString()
  id!: string;

  @IsString()
  requestId!: string;

  @IsString()
  reference!: string;

  @IsString()
  reason!: string;

  @IsISO8601()
  createdAt!: string;

  @ValidateNested()
  @Type(() => OrderRefundAuthorDTO)
  author!: OrderRefundAuthorDTO;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderRefundItemDTO)
  items!: OrderRefundItemDTO[];

  @IsInt()
  @Min(0)
  deliveryKopecks!: number;

  @IsInt()
  @Min(0)
  totalKopecks!: number;

  @IsInt()
  @Min(0)
  reversedCommissionKopecks!: number;
}

export class OrderRefundsDTO {
  @IsString()
  orderId!: string;

  @IsBoolean()
  canRecord!: boolean;

  @IsOptional()
  @IsString()
  blockedReason!: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderRefundableItemDTO)
  items!: OrderRefundableItemDTO[];

  @ValidateNested()
  @Type(() => OrderRefundDeliveryDTO)
  delivery!: OrderRefundDeliveryDTO;

  @IsInt()
  @Min(0)
  totalRefundedKopecks!: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => OrderRefundCommissionDTO)
  commission!: OrderRefundCommissionDTO | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderRefundDTO)
  refunds!: OrderRefundDTO[];
}
