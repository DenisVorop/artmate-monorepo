import { IsISO8601, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

import { ORDER_ADMIN_COMMENT_MAX_LENGTH } from "../orders.constants";

export class AdminOrderCommentDTO {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  authorId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  authorName?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(ORDER_ADMIN_COMMENT_MAX_LENGTH)
  body!: string;

  @IsISO8601()
  createdAt!: string;
}
