import { IsEmail } from "class-validator";

export class RequestPasswordResetRequestDTO {
  @IsEmail()
  email!: string;
}
