import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

import { AuthGuard } from "../auth/auth.guard";
import type { AuthUser } from "../auth/auth.types";
import { ValidateResponse } from "../common/response-validation.interceptor";

import {
  AdminUserDTO,
  UpdateUserRolesRequestDTO,
  UpdateUserStatusRequestDTO,
} from "./dto";
import { UsersService } from "./users.service";

type AuthenticatedRequest = {
  user: AuthUser;
};

@ApiTags("Users")
@UseGuards(AuthGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ValidateResponse(AdminUserDTO, { isArray: true })
  @ApiOperation({ summary: "List users for admin panel" })
  @ApiOkResponse({ type: [AdminUserDTO] })
  @Get()
  getUsers(@Req() request: AuthenticatedRequest) {
    this.usersService.assertRole(request.user, "admin");

    return this.usersService.getAdminUsers();
  }

  @ValidateResponse(AdminUserDTO)
  @ApiOperation({ summary: "Update user roles from admin panel" })
  @ApiOkResponse({ type: AdminUserDTO })
  @Patch(":id/roles")
  updateUserRoles(
    @Param("id") id: string,
    @Body() body: UpdateUserRolesRequestDTO,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");

    return this.usersService.updateAdminUserRoles(id, body.roles, request.user);
  }

  @ValidateResponse(AdminUserDTO)
  @ApiOperation({ summary: "Update user account status from admin panel" })
  @ApiOkResponse({ type: AdminUserDTO })
  @Patch(":id/status")
  updateUserStatus(
    @Param("id") id: string,
    @Body() body: UpdateUserStatusRequestDTO,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");

    return this.usersService.updateAdminUserStatus(
      id,
      body.status,
      request.user,
    );
  }
}
