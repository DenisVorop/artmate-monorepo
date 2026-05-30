import { IsISO8601, IsOptional, IsString } from "class-validator";

export class AdminUserTelegramAccountDTO {
  @IsString()
  telegramUserId!: string;

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

  @IsISO8601()
  linkedAt!: string;
}
