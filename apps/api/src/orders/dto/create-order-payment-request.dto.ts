import { IsIn } from "class-validator";

import { paymentMethods, type PaymentMethod } from "../orders.constants";

export class CreateOrderPaymentRequestDTO {
  @IsIn(paymentMethods)
  method!: PaymentMethod;
}
