import { Matches } from "class-validator";

export class ConfirmTelegramLinkRequestDTO {
  @Matches(/^\d{6}$/)
  code!: string;
}
