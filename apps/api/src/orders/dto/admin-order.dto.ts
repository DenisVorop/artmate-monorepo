import { Type } from "class-transformer";
import { IsArray, IsString, ValidateNested } from "class-validator";

import { AdminOrderCommentDTO } from "./admin-order-comment.dto";
import { AdminOrderHistoryEventDTO } from "./admin-order-history-event.dto";
import { OrderDTO } from "./order.dto";

export class AdminOrderDTO extends OrderDTO {
  @IsArray()
  @IsString({ each: true })
  ozonPostingNumbers!: string[];

  @IsArray()
  @IsString({ each: true })
  ozonFbsPostingNumbers!: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminOrderCommentDTO)
  adminComments!: AdminOrderCommentDTO[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminOrderHistoryEventDTO)
  history!: AdminOrderHistoryEventDTO[];
}
