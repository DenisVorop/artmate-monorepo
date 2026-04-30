import { IsArray, IsIn, IsOptional, IsString } from "class-validator";

import { userRoles, type UserRole } from "../../users/users.types";

export class AuthUserDTO {
  @IsString()
  id!: string;

  @IsIn(["credentials", "yandex"])
  provider!: "credentials" | "yandex";

  @IsString()
  providerUserId!: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsArray()
  @IsIn(userRoles, { each: true })
  roles!: UserRole[];
}
