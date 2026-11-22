import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import crypto from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { CustomerDirectoryReader } from "../auth/customer-directory.reader";
import { CustomerAuthSubjectLock } from "../users/contracts/customer-auth-subject-lock";
import type { AuthUser } from "../auth/auth.types";
import type { RequestEvidenceV1 } from "../common/request-evidence";
import { ConsentChecks } from "./consent-checks";
import { RecipientConsentLock } from "./contracts/recipient-consent-lock";
import { EmailAdvertisingRevision } from "./email-advertising-revision";
import { EmailAdvertisingGrant } from "./email-advertising-grant";
import type { GrantEmailAdvertisingDTO } from "./dto/email-advertising.dto";

/** A click by an authenticated, verified account grants advertising only.
 * No Auth flow, profile write, PDn acceptance or new access cookie is created. */
@Injectable()
export class EmailAdvertisingSettingsGrantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly directory: CustomerDirectoryReader,
  ) {}

  public async grant(
    actor: AuthUser,
    input: GrantEmailAdvertisingDTO,
    context: RequestEvidenceV1,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await CustomerAuthSubjectLock.acquire(tx, actor.id);
      const user = await this.directory.byId(tx, actor.id);
      if (
        !user ||
        user.status !== "active" ||
        !user.email ||
        user.email !== actor.email ||
        !ConsentChecks.verified({
          email: user.email,
          verifiedAt: user.emailVerifiedAt,
        })
      )
        throw new UnauthorizedException("A verified account is required");
      await ConsentChecks.lockRegistry(tx);
      await RecipientConsentLock.acquire(tx, user.email);
      const revisionId = await EmailAdvertisingRevision.current(tx);
      if (!revisionId)
        throw new ServiceUnavailableException(
          "Advertising consent is unavailable",
        );
      if (revisionId !== input.revisionId)
        throw new ConflictException("Advertising consent has changed");
      const subscription = await tx.emailAdvertisingSubscription.findUnique({
        where: { email: user.email },
      });
      const version = subscription?.version ?? 0;
      const currentState = await tx.userConsentState.findUnique({
        where: { email: user.email },
        select: { revision: true },
      });
      const stateRevision = currentState?.revision ?? 0;
      const operationKey = crypto
        .createHash("sha256")
        .update(
          JSON.stringify([
            "settings-grant-v1",
            actor.id,
            user.email,
            input.revisionId,
            input.expectedVersion,
            input.expectedStateRevision,
          ]),
        )
        .digest("hex");
      const prior =
        subscription &&
        (await tx.emailAdvertisingConsentEvent.findUnique({
          where: {
            subscriptionId_operationKey: {
              subscriptionId: subscription.id,
              operationKey,
            },
          },
        }));
      if (prior) {
        if (
          subscription.state !== "ACTIVE" ||
          subscription.activeGrantId !== prior.id
        )
          throw new ConflictException("Advertising permission has changed");
        return {
          email: user.email,
          subscribed: true,
          version,
          stateRevision,
          grantRevisionId: revisionId,
        };
      }
      if (
        version !== input.expectedVersion ||
        stateRevision !== input.expectedStateRevision
      )
        throw new ConflictException("Advertising permission has changed");
      if (subscription?.state === "ACTIVE")
        return {
          email: user.email,
          subscribed: true,
          version,
          stateRevision,
          grantRevisionId: revisionId,
        };
      const requestId = crypto.randomUUID();
      const evidence = {
        actorUserIdSnapshot: actor.id,
        email: user.email,
        emailVerifiedAtSnapshot: user.emailVerifiedAt!,
        revisionId,
        operationKey,
        source: "notification_settings",
        requestId,
        requestContext: context,
        occurredAt: new Date(),
      };
      const event = await EmailAdvertisingGrant.apply(tx, {
        ...evidence,
        payloadHash: crypto
          .createHash("sha256")
          .update(
            JSON.stringify({
              ...evidence,
              expectedVersion: input.expectedVersion,
              expectedStateRevision: input.expectedStateRevision,
            }),
          )
          .digest("hex"),
      });
      const nextState = await tx.userConsentState.upsert({
        where: { email: user.email },
        create: { email: user.email, revision: 1, requiredAcceptances: [] },
        update: { revision: { increment: 1 } },
      });
      return {
        email: user.email,
        subscribed: true,
        version: event.version,
        stateRevision: nextState.revision,
        grantRevisionId: revisionId,
      };
    });
  }
}
