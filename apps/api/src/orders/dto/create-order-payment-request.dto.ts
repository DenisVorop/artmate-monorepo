import { IsIn } from "class-validator";

import {
  createOrderPaymentMethods,
  type CreateOrderPaymentMethod,
} from "../orders.constants";

export class CreateOrderPaymentRequestDTO {
  @IsIn(createOrderPaymentMethods)
  method!: CreateOrderPaymentMethod;
}
