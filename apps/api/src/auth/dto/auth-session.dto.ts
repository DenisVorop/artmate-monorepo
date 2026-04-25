import { Type } from "class-transformer";
import { IsOptional, ValidateNested } from "class-validator";

import { AuthUserDTO } from "./auth-user.dto";

export class AuthSessionDTO {
  @IsOptional()
  @ValidateNested()
  @Type(() => AuthUserDTO)
  user!: AuthUserDTO | null;
}
