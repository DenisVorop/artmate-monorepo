import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  Equals,
  IsArray,
  IsDefined,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { CreateOrderCustomerRequestDTO } from "../dto/create-order-customer-request.dto";

export class CreatePrizeOrderRequestDTO {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(32, { each: true })
  albumIds!: string[];
  @IsDefined()
  @ValidateNested()
  @Type(() => CreateOrderCustomerRequestDTO)
  customer!: CreateOrderCustomerRequestDTO;
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  pickupPointId!: string;
  @Equals(true) acceptedLegal!: boolean;
  @Equals(true) acceptedPersonalDataConsent!: boolean;
  @IsOptional() @IsString() @MaxLength(1000) comment?: string;
}
