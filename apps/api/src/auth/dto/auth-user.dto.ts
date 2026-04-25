import { IsArray, IsIn, IsOptional, IsString } from "class-validator";

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
  @IsString({ each: true })
  roles!: string[];
}
