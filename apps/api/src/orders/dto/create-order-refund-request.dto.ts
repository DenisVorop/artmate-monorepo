import { Type } from "class-transformer";
import {
  ArrayUnique,
  Equals,
  IsArray,
  IsInt,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

export class CreateOrderRefundItemRequestDTO {
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  productId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateOrderRefundRequestDTO {
  @IsUUID()
  requestId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  reference!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  reason!: string;

  @IsArray()
  @ArrayUnique((item: CreateOrderRefundItemRequestDTO) => item.productId)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderRefundItemRequestDTO)
  items!: CreateOrderRefundItemRequestDTO[];

  @IsInt()
  @Min(0)
  deliveryKopecks!: number;

  @Equals(true)
  confirmed!: true;
}
