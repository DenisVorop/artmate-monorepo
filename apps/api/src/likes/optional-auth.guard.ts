import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";
import type { AuthUser } from "../auth/auth.types";

export type LikeRequest = {
  headers: { authorization?: string; cookie?: string };
  user?: AuthUser;
};

/** Guest reads are allowed; supplied expired/invalid credentials are not ignored. */
@Injectable()
export class OptionalLikeAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<LikeRequest>();
    const token = this.auth.getTokenFromRequest(
      request.headers.authorization,
      request.headers.cookie,
    );
    if (token) request.user = await this.auth.verifyAccessToken(token);
    return true;
  }
}
