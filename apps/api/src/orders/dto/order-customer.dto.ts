import { IsEmail, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class OrderCustomerDTO {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  phone?: string;

  @IsEmail()
  email!: string;
}
