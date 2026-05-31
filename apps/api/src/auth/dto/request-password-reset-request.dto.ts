import { Equals, IsBoolean, IsEmail } from "class-validator";

export class RequestPasswordResetRequestDTO {
  @IsBoolean()
  @Equals(true)
  acceptedPersonalDataConsent!: boolean;

  @IsEmail()
  email!: string;
}
