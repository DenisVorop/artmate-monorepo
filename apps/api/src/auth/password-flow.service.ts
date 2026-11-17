import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { RecordedEmailProof } from "./recorded-email-proof";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestEvidenceV1 } from "../common/request-evidence";
import { CustomerDirectoryReader } from "./customer-directory.reader";
import { AuthFlowStore } from "./flow.store";
import { FlowCredentials } from "./flow-credentials";
import type {
  AuthFlowCredentials,
  AuthFlowStarted,
  EmailConfirmationRequired,
} from "./contracts/flow-response.contract";
import { LoginThrottleService } from "./login-throttle.service";
import { CredentialsAuthService } from "./credentials-auth.service";
import { PasswordHasher } from "./password-hasher";

@Injectable()
export class PasswordFlowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly directory: CustomerDirectoryReader,
    private readonly store: AuthFlowStore,
    private readonly throttle: LoginThrottleService,
    private readonly credentialsAuth: CredentialsAuthService,
  ) {}

  public async start(
    input: { email: string; password: string },
    context: RequestEvidenceV1,
    existing?: AuthFlowCredentials,
  ): Promise<
    AuthFlowStarted | { state: EmailConfirmationRequired; credentials?: never }
  > {
    const email = input.email.trim().toLowerCase();
    const subject = { email, ipAddress: context.client.ipAddress ?? undefined };
    await this.throttle.assertLoginAllowed(subject);
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const user = await this.directory.byEmail(tx, email);
        const account = user
          ? await tx.authAccount.findUnique({
              where: {
                userId_provider: {
                  userId: user.userId,
                  provider: "CREDENTIALS",
                },
              },
              include: { credential: true },
            })
          : null;
        const storedValid = await PasswordHasher.verify(
          input.password,
          account?.credential?.passwordHash ??
            `scrypt:${"0".repeat(32)}:${"0".repeat(128)}`,
        );
        const envBinding = !account?.credential
          ? await this.credentialsAuth.validateFlowEnvPassword(
              email,
              input.password,
            )
          : null;
        const valid = account?.credential ? storedValid : !!envBinding;
        if (!valid || !user || user.status !== "active" || !account)
          throw new UnauthorizedException("Invalid email or password");
        await tx.$queryRaw`SELECT id FROM auth_accounts WHERE id = ${account.id} FOR UPDATE`;
        const current = await tx.authCredential.findUnique({
          where: { accountId: account.id },
        });
        const currentUser = await this.directory.byId(tx, user.userId);
        if (
          (!envBinding &&
            (!current ||
              current.passwordHash !== account.credential?.passwordHash)) ||
          (envBinding &&
            (current ||
              this.credentialsAuth.getEnvCredentialBinding(email) !==
                envBinding)) ||
          !currentUser ||
          currentUser.status !== "active" ||
          currentUser.authVersion !== user.authVersion ||
          currentUser.email !== email
        )
          throw new UnauthorizedException("Invalid email or password");
        if (envBinding && !currentUser.emailVerifiedAt)
          throw new UnauthorizedException("Invalid email or password");
        const proof = currentUser.emailVerifiedAt
          ? await RecordedEmailProof.resolve(tx, currentUser, context)
          : await tx.verifiedIdentityFact.findFirst({
              where: {
                email,
                userIdSnapshot: currentUser.userId,
                method: "EMAIL_CODE",
                verifiedAt: { lte: new Date() },
              },
              orderBy: { verifiedAt: "desc" },
            });
        if (!proof)
          return {
            state: {
              status: "EMAIL_CONFIRMATION_REQUIRED",
              nextStep: "email",
            } as const,
          };
        let credentials = existing ?? FlowCredentials.create();
        if (existing) {
          const previous = await tx.authPendingFlow.findUnique({
            where: { capabilityHash: FlowCredentials.capabilityHash(existing) },
          });
          if (
            previous &&
            previous.browserBindingHash !==
              FlowCredentials.browserHash(existing)
          )
            throw new UnauthorizedException("Invalid auth continuation");
          if (
            previous &&
            (previous.status !== "OPEN" || previous.expiresAt <= new Date())
          )
            credentials = FlowCredentials.create(existing.browser);
          else if (previous) {
            const authentication =
              await tx.authAuthenticationFact.findUniqueOrThrow({
                where: { id: previous.authenticationFactId },
              });
            if (
              previous.userIdSnapshot !== user.userId ||
              !["PASSWORD", "ENV_PASSWORD"].includes(authentication.method)
            )
              throw new ConflictException(
                "Another authentication is in progress",
              );
            if (
              authentication.authVersion !== currentUser.authVersion ||
              authentication.credentialUpdatedAt?.getTime() !==
                current?.passwordUpdatedAt.getTime() ||
              authentication.envCredentialBindingSnapshot !== envBinding
            )
              credentials = FlowCredentials.create(existing.browser);
          }
        }
        const flow = await this.store.create(tx, {
          credentials,
          user: currentUser,
          identityFactId: proof.id,
          method: envBinding ? "ENV_PASSWORD" : "PASSWORD",
          accountId: account.id,
          credentialUpdatedAt: current?.passwordUpdatedAt ?? null,
          envCredentialBinding: envBinding,
          context,
        });
        return { credentials, state: await this.store.state(tx, flow) };
      });
      await this.throttle.recordSuccessfulLogin(subject);
      return result;
    } catch (error) {
      if (error instanceof UnauthorizedException)
        await this.throttle.recordFailedLogin(subject);
      throw error;
    }
  }
}
