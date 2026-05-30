import { Type } from "class-transformer";
import { IsArray, ValidateNested } from "class-validator";

import { AdminOrderCommentDTO } from "./admin-order-comment.dto";
import { AdminOrderHistoryEventDTO } from "./admin-order-history-event.dto";
import { OrderDTO } from "./order.dto";

export class AdminOrderDTO extends OrderDTO {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminOrderCommentDTO)
  adminComments!: AdminOrderCommentDTO[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminOrderHistoryEventDTO)
  history!: AdminOrderHistoryEventDTO[];
}
