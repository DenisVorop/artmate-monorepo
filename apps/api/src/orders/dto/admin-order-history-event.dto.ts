import {
  IsISO8601,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from "class-validator";

export class AdminOrderHistoryEventDTO {
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
  eventType!: string;

  @IsObject()
  payload!: Record<string, unknown>;

  @IsISO8601()
  createdAt!: string;
}
