import { Type } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";

import {
  userRoles,
  userStatuses,
  type UserRole,
  type UserStatus,
} from "../users.types";

import { AdminUserAuthAccountDTO } from "./admin-user-auth-account.dto";
import { AdminUserTelegramAccountDTO } from "./admin-user-telegram-account.dto";

export class AdminUserDTO {
  @IsString()
  id!: string;

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

  @IsIn(userStatuses)
  status!: UserStatus;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminUserAuthAccountDTO)
  authAccounts!: AdminUserAuthAccountDTO[];

  @IsOptional()
  @ValidateNested()
  @Type(() => AdminUserTelegramAccountDTO)
  telegramAccount?: AdminUserTelegramAccountDTO;

  @IsISO8601()
  createdAt!: string;

  @IsISO8601()
  updatedAt!: string;
}
