import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";

import { AuthService } from "./auth.service";
import { AUTH_ACCESS_TOKEN_COOKIE_NAME } from "./auth.constants";
import type { AuthUser } from "./auth.types";

type AuthenticatedRequest = {
  headers: {
    authorization?: string;
    cookie?: string;
  };
  user?: AuthUser;
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.authService.getTokenFromRequest(
      request.headers.authorization,
      request.headers.cookie,
    );

    if (!token) {
      throw new UnauthorizedException("Authentication required");
    }

    request.user = await this.authService.verifyAccessToken(token);

    return true;
  }
}

export function getAuthCookieName() {
  return AUTH_ACCESS_TOKEN_COOKIE_NAME;
}
