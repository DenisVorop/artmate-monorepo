import { ApiProperty } from "@nestjs/swagger";
import {
  IsDefined,
  IsInt,
  IsNumber,
  IsString,
  Min,
  ValidateIf,
} from "class-validator";

export class CreateOrderResponseDTO {
  @ApiProperty()
  @IsInt()
  @Min(1)
  itemsCount!: number;

  @ApiProperty()
  @IsString()
  orderId!: string;

  @ApiProperty({ nullable: true, type: String })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  redirectUrl!: string | null;

  @ApiProperty()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  revenue!: number;
}
