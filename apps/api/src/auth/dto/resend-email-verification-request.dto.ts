import { IsString, MinLength } from "class-validator";

export class ResendEmailVerificationRequestDTO {
  @IsString()
  @MinLength(3)
  login!: string;
}
