import { IsEmail, IsNotEmpty, IsString } from "class-validator";

export class OrderCustomerDTO {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsEmail()
  email!: string;
}
