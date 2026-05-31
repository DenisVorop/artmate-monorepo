import { Equals, IsBoolean, Matches } from "class-validator";

export class ConfirmTelegramLinkRequestDTO {
  @IsBoolean()
  @Equals(true)
  acceptedPersonalDataConsent!: boolean;

  @Matches(/^\d{6}$/)
  code!: string;
}
