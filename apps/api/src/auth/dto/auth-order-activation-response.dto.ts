import { IsBoolean } from "class-validator";

export class AuthOrderActivationResponseDTO {
  @IsBoolean()
  valid!: boolean;
}
