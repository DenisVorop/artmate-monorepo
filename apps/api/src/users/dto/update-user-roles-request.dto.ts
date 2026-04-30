import { ArrayNotEmpty, IsArray, IsIn } from "class-validator";

import { userRoles, type UserRole } from "../users.types";

export class UpdateUserRolesRequestDTO {
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(userRoles, { each: true })
  roles!: UserRole[];
}
