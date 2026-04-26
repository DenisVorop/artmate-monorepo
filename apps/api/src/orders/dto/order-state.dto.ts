import { IsIn, IsNotEmpty, IsString } from "class-validator";

import {
  orderStatuses,
  paymentStatuses,
  type OrderStatus,
  type PaymentStatus,
} from "../orders.constants";

export class OrderStateDTO {
  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @IsIn(orderStatuses)
  status!: OrderStatus;

  @IsIn(paymentStatuses)
  paymentStatus!: PaymentStatus;
}
