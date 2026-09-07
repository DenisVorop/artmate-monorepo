import { IsString } from "class-validator";

export class ValidateOrderActivationRequestDTO {
  @IsString()
  token!: string;
}
