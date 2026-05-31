import {
  Equals,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";

export class RegisterRequestDTO {
  @IsBoolean()
  @Equals(true)
  acceptedPersonalDataConsent!: boolean;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsEmail()
  email!: string;
}
