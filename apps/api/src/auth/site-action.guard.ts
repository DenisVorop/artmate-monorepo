import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ConsentReadModel } from "../consents/contracts/consent-read-model";
import { PrismaService } from "../prisma/prisma.service";
import { CustomerProfileValues } from "../users/contracts/customer-profile-values";
import { AuthService } from "./auth.service";
import { CustomerDirectoryReader } from "./customer-directory.reader";
import type {
  SiteAction,
  SiteActionRequest,
} from "./contracts/site-action-access.contract";
import { siteActionMetadataKey } from "./require-site-action";

/** Independent HTTP access boundary: Auth verifies identity; Users and Consents
 * publish readiness. This guard never changes another domain or grants consent. */
@Injectable()
export class SiteActionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
    private readonly directory: CustomerDirectoryReader,
  ) {}

  public async canActivate(context: ExecutionContext) {
    const action = this.reflector.get<SiteAction>(
      siteActionMetadataKey,
      context.getHandler(),
    );
    if (action !== "partner_application")
      throw new ForbiddenException("Unsupported site action");
    const request = context.switchToHttp().getRequest<SiteActionRequest>();
    const token = this.auth.getTokenFromRequest(
      request.headers.authorization,
      request.headers.cookie,
    );
    if (!token) throw new UnauthorizedException("Authentication required");
    const { principal } = await this.auth.verifyFlowSession(token);
    request.siteAction = await this.prisma.$transaction(async (tx) => {
      const user = await this.directory.byId(tx, principal.id);
      if (
        !user ||
        user.status !== "active" ||
        !user.email ||
        user.email !== principal.email ||
        user.authVersion !== principal.authVersion ||
        !user.emailVerifiedAt
      )
        throw new UnauthorizedException("A verified account is required");
      if (user.profileRevision === null)
        throw new ServiceUnavailableException(
          "Customer profile publication is unavailable",
        );
      if (CustomerProfileValues.select(user).missingFields.length)
        throw new ForbiddenException("Complete your contact details first");
      // Partner applications use the common forms consent.
      const purpose = "site_auth" as const;
      const readiness = await ConsentReadModel.read(tx, user.email, purpose);
      if (!readiness)
        throw new ServiceUnavailableException(
          "Consent documents are unavailable",
        );
      const acceptance = await ConsentReadModel.requiredAcceptance(
        tx,
        readiness,
        user.userId,
      );
      if (!acceptance)
        throw new ForbiddenException("Personal data consent is required");
      return {
        contractVersion: 1 as const,
        action,
        purpose,
        actor: { userId: user.userId, email: user.email },
        requiredConsent: {
          acceptanceId: acceptance.id,
          revisionId: acceptance.revisionId,
        },
      };
    });
    return true;
  }
}
