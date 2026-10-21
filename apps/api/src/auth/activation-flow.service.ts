import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { Prisma } from "../generated/prisma/client";
import type { RequestEvidenceV1 } from "../common/request-evidence";
import type {
  AuthFlowCredentials,
  AuthFlowStarted,
} from "./contracts/flow-response.contract";
import { CustomerDirectoryReader } from "./customer-directory.reader";
import { AuthFlowStore } from "./flow.store";
import { FlowCredentials } from "./flow-credentials";
import { CredentialsAuthService } from "./credentials-auth.service";
import { PasswordHasher } from "./password-hasher";
import {
  verifyOrderActivationToken,
  createOrderActivationTokenHash,
} from "./order-activation-token";

/** Auth-local link exchange. Existing guest identity and orders remain untouched. */
@Injectable()
export class ActivationFlowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly directory: CustomerDirectoryReader,
    private readonly store: AuthFlowStore,
    private readonly credentials: CredentialsAuthService,
  ) {}

  public async exchange(
    token: string,
    actor: AuthFlowCredentials,
    context: RequestEvidenceV1,
  ): Promise<AuthFlowStarted> {
    FlowCredentials.validate(actor);
    const secret = process.env.AUTH_JWT_SECRET?.trim();
    if (!secret)
      throw new InternalServerErrorException(
        "AUTH_JWT_SECRET is not configured",
      );
    const tokenId = verifyOrderActivationToken(token, secret);
    if (!tokenId) throw this._invalidLink();
    const hash = createOrderActivationTokenHash(token, secret);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM auth_order_activation_tokens WHERE id = ${tokenId} FOR UPDATE`;
      const link = await tx.authOrderActivationToken.findUnique({
        where: { id: tokenId },
      });
      const now = new Date();
      if (
        !link ||
        !PasswordHasher.equal(link.tokenHash, hash) ||
        link.expiresAt <= now
      )
        throw this._invalidLink();
      if (link.consumedAt) {
        const flow = await this.store.find(tx, actor);
        if (!flow || flow.activationTokenIdSnapshot !== tokenId)
          throw this._invalidLink();
        return { credentials: actor, state: await this.store.state(tx, flow) };
      }
      if (await this.store.find(tx, actor))
        throw new ConflictException("Another authentication is in progress");
      await tx.$queryRaw`SELECT id FROM auth_accounts WHERE user_id = ${link.userId} FOR UPDATE`;
      const user = await this.directory.byId(tx, link.userId);
      const accounts = await tx.authAccount.findMany({
        where: { userId: link.userId },
        include: { credential: true },
      });
      const account = accounts.find((item) => item.provider === "CREDENTIALS");
      if (
        !user ||
        user.status !== "active" ||
        !user.email ||
        !account ||
        accounts.some(
          (item) => item.credential || item.provider !== "CREDENTIALS",
        ) ||
        this.credentials.getEnvCredentialBinding(user.email)
      )
        throw this._invalidLink();
      const consumed = await tx.authOrderActivationToken.updateMany({
        where: {
          id: link.id,
          userId: user.userId,
          tokenHash: hash,
          consumedAt: null,
          expiresAt: { gt: now },
        },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1) throw this._invalidLink();
      const proof = await tx.verifiedIdentityFact.create({
        data: {
          email: user.email,
          method: "ORDER_ACTIVATION_LINK",
          sourceId: link.id,
          userIdSnapshot: user.userId,
          verifiedAt: now,
          createdAt: now,
          requestContext: context as unknown as Prisma.InputJsonValue,
        },
      });
      const flow = await this.store.create(tx, {
        credentials: actor,
        user,
        identityFactId: proof.id,
        method: "ORDER_ACTIVATION",
        accountId: account.id,
        credentialUpdatedAt: null,
        sourceId: link.id,
        authenticatedAt: now,
        activationToken: { id: link.id, expiresAt: link.expiresAt },
        context,
      });
      return { credentials: actor, state: await this.store.state(tx, flow) };
    });
  }

  private _invalidLink() {
    return new BadRequestException(
      "Order activation link is invalid or expired",
    );
  }
}
