import { Type } from "class-transformer";
import { IsDefined, ValidateNested } from "class-validator";

import { CreateOrderDeliveryRequestDTO } from "./create-order-delivery-request.dto";

export class CalculateCheckoutRequestDTO {
  @IsDefined()
  @ValidateNested()
  @Type(() => CreateOrderDeliveryRequestDTO)
  delivery!: CreateOrderDeliveryRequestDTO;
}
