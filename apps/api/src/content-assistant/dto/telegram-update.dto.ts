import { Allow, IsOptional } from "class-validator";

export class TelegramUpdateDTO {
  @IsOptional()
  @Allow()
  update_id?: unknown;

  @IsOptional()
  @Allow()
  callback_query?: unknown;

  @IsOptional()
  @Allow()
  message?: unknown;
}
