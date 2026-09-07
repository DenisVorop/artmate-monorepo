import { Equals, IsBoolean, IsEmail } from "class-validator";

export class RequestAccountRecoveryDTO {
  @IsBoolean()
  @Equals(true)
  acceptedPersonalDataConsent!: boolean;

  @IsEmail()
  email!: string;
}
