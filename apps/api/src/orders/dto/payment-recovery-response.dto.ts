import { ApiProperty } from "@nestjs/swagger";
import { IsDefined, IsString, ValidateIf } from "class-validator";

export class PaymentRecoveryResponseDTO {
  @ApiProperty({ nullable: true, type: String })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  redirectUrl!: string | null;
}
