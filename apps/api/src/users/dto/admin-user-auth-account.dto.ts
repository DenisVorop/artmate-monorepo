import { IsIn, IsISO8601, IsOptional, IsString } from "class-validator";

export class AdminUserAuthAccountDTO {
  @IsIn(["credentials", "yandex"])
  provider!: "credentials" | "yandex";

  @IsString()
  providerUserId!: string;

  @IsOptional()
  @IsString()
  providerEmail?: string;

  @IsISO8601()
  connectedAt!: string;

  @IsOptional()
  @IsISO8601()
  lastLoginAt?: string;
}
