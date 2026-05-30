import { Type } from "class-transformer";
import {
  IsArray,
  IsDefined,
  IsISO8601,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

import { CartItemDTO } from "../../cart/dto";
import {
  ORDER_COMMENT_MAX_LENGTH,
  orderStatuses,
  type OrderStatus,
} from "../orders.constants";

import { OrderCustomerDTO } from "./order-customer.dto";
import { OrderDeliveryDTO } from "./order-delivery.dto";
import { OrderPaymentDTO } from "./order-payment.dto";
import { OrderShipmentDTO } from "./order-shipment.dto";

export class OrderDTO {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsString()
  @IsNotEmpty()
  cartId!: string;

  @IsIn(orderStatuses)
  status!: OrderStatus;

  @IsDefined()
  @ValidateNested()
  @Type(() => OrderCustomerDTO)
  customer!: OrderCustomerDTO;

  @IsDefined()
  @ValidateNested()
  @Type(() => OrderDeliveryDTO)
  delivery!: OrderDeliveryDTO;

  @IsDefined()
  @ValidateNested()
  @Type(() => OrderPaymentDTO)
  payment!: OrderPaymentDTO;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemDTO)
  items!: CartItemDTO[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderShipmentDTO)
  shipments!: OrderShipmentDTO[];

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

  @IsOptional()
  @IsString()
  @MaxLength(ORDER_COMMENT_MAX_LENGTH)
  comment?: string;

  @IsISO8601()
  createdAt!: string;

  @IsOptional()
  @IsISO8601()
  paidAt?: string;
}
