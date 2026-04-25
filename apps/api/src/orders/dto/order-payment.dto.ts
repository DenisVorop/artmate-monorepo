import { IsIn, IsNotEmpty, IsString } from "class-validator";

import {
  paymentMethods,
  paymentStatuses,
  type PaymentMethod,
  type PaymentStatus,
} from "../orders.constants";

export class OrderPaymentDTO {
  @IsIn(paymentMethods)
  method!: PaymentMethod;

  @IsIn(paymentStatuses)
  status!: PaymentStatus;

  @IsString()
  @IsNotEmpty()
  redirectUrl!: string;
}
