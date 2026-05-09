import { IsNotEmpty, IsString, MaxLength } from "class-validator";

import { ORDER_ADMIN_COMMENT_MAX_LENGTH } from "../orders.constants";

export class CreateOrderAdminCommentRequestDTO {
  @IsString()
  @IsNotEmpty()
  @MaxLength(ORDER_ADMIN_COMMENT_MAX_LENGTH)
  body!: string;
}
