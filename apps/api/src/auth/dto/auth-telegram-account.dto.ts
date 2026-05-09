import { IsDateString, IsOptional, IsString } from "class-validator";

export class AuthTelegramAccountDTO {
  @IsString()
  phone!: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsDateString()
  linkedAt!: string;
}
