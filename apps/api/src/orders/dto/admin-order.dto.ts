import { Type } from "class-transformer";
import { IsArray, IsOptional, ValidateNested } from "class-validator";

import { AdminOrderDiscountDTO } from "./admin-order-discount.dto";
import { AdminOrderCommentDTO } from "./admin-order-comment.dto";
import { AdminOrderHistoryEventDTO } from "./admin-order-history-event.dto";
import { OrderDTO } from "./order.dto";
import { OzonPostingDTO } from "./ozon-posting.dto";

export class AdminOrderDTO extends OrderDTO {
  @IsOptional()
  @ValidateNested()
  @Type(() => AdminOrderDiscountDTO)
  discountBreakdown!: AdminOrderDiscountDTO | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OzonPostingDTO)
  ozonPostings!: OzonPostingDTO[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminOrderCommentDTO)
  adminComments!: AdminOrderCommentDTO[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminOrderHistoryEventDTO)
  history!: AdminOrderHistoryEventDTO[];
}
