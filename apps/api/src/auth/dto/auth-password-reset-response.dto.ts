import { IsBoolean } from "class-validator";

export class AuthPasswordResetResponseDTO {
  @IsBoolean()
  ok!: true;
}
