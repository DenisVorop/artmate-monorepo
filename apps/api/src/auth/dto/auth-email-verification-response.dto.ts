import { Type } from "class-transformer";
import { IsIn, ValidateNested } from "class-validator";

import { AuthEmailVerificationStateDTO } from "./auth-email-verification-state.dto";

export class AuthEmailVerificationResponseDTO {
  @IsIn(["verification_required"])
  status!: "verification_required";

  @ValidateNested()
  @Type(() => AuthEmailVerificationStateDTO)
  verification!: AuthEmailVerificationStateDTO;
}
