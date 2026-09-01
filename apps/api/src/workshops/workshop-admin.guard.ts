import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";

import type { AuthUser } from "../auth/auth.types";
import { UsersService } from "../users/users.service";

@Injectable()
export class WorkshopAdminGuard implements CanActivate {
  constructor(private readonly users: UsersService) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ user: AuthUser }>();
    this.users.assertRole(request.user, "admin");
    return true;
  }
}
