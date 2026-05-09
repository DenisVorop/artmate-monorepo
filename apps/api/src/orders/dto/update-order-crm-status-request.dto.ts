import { IsIn } from "class-validator";

import {
  orderStatuses,
  type OrderStatus,
} from "../orders.constants";

export class UpdateOrderStatusRequestDTO {
  @IsIn(orderStatuses)
  status!: OrderStatus;
}
