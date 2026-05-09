import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateTelegramLinkCodeRequestDTO {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  telegramUserId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  telegramChatId!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(80)
  phone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  lastName?: string;
}
