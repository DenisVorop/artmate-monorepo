import crypto from "node:crypto";
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma, type AuthEmailChallenge } from "../generated/prisma/client";
import type { RegistrationEmailCommandV1 } from "../notifications/contracts/registration-email-command.contract";
import type { RequestEvidenceV1 } from "../common/request-evidence";
import { CredentialsAuthService } from "./credentials-auth.service";
import { CustomerDirectoryReader } from "./customer-directory.reader";
import { AuthFlowStore } from "./flow.store";
import { FlowCredentials } from "./flow-credentials";
import type {
  AuthFlowCredentials,
  AuthFlowResponseV1,
  AuthFlowStarted,
} from "./contracts/flow-response.contract";
import { RegistrationCode } from "./registration-code";
import { RegistrationPolicy } from "./registration-policy";
import { PasswordHasher } from "./password-hasher";

@Injectable()
export class RegistrationCodeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly directory: CustomerDirectoryReader,
    private readonly store: AuthFlowStore,
    private readonly credentials: CredentialsAuthService,
  ) {}

  public async request(
    email: string,
    context: RequestEvidenceV1,
    browser?: string,
  ): Promise<AuthFlowStarted> {
    const credentials = FlowCredentials.create(browser);
    const normalized = email.trim().toLowerCase();
    const secret = RegistrationCode.secret();
    const ipHash = RegistrationCode.hash(
      ["registration-ip-v1", context.client.ipAddress],
      secret,
    );
    const row = await this.prisma.$transaction(async (tx) => {
      await this._lockSend(tx, normalized, ipHash, secret);
      await this._assertSendAllowed(tx, normalized, ipHash);
      const policy = RegistrationPolicy.get();
      const now = new Date();
      const nonce = crypto.randomBytes(32).toString("hex");
      const id = FlowCredentials.challengeId(credentials);
      const code = RegistrationCode.derive(id, nonce, 1, secret);
      const challenge = await tx.authEmailChallenge.create({
        data: {
          id,
          email: normalized,
          nonce,
          browserBindingHash: FlowCredentials.browserHash(credentials),
          hashKeyVersion: RegistrationCode.keyVersion,
          codeHash: RegistrationCode.digest(id, nonce, 1, code, secret),
          maxAttempts: policy.maxAttempts,
          expiresAt: new Date(now.getTime() + policy.ttlMs),
          resendAvailableAt: new Date(now.getTime() + policy.cooldownMs),
          ipHash,
          sentAt: now,
          createdAt: now,
        },
      });
      await this._enqueue(tx, challenge);
      return challenge;
    });
    return { credentials, state: this._state(row) };
  }

  public async resend(
    credentials: AuthFlowCredentials,
  ): Promise<AuthFlowResponseV1> {
    FlowCredentials.validate(credentials);
    const secret = RegistrationCode.secret();
    return this.prisma.$transaction(async (tx) => {
      // Sending paths take the same email/IP locks before the challenge lock.
      const initial = await tx.authEmailChallenge.findUnique({
        where: { id: FlowCredentials.challengeId(credentials) },
      });
      this._assertOwned(initial, credentials);
      await this._lockSend(tx, initial.email, initial.ipHash!, secret);
      const challenge = await this.lock(tx, credentials);
      if (
        challenge.consumedAt ||
        challenge.expiresAt <= new Date() ||
        challenge.failedAttempts >= challenge.maxAttempts
      )
        throw new BadRequestException("Verification code expired");
      await this._assertSendAllowed(tx, challenge.email, challenge.ipHash!);
      const policy = RegistrationPolicy.get();
      const now = new Date();
      const generation = challenge.generation + 1;
      const nonce = crypto.randomBytes(32).toString("hex");
      const code = RegistrationCode.derive(
        challenge.id,
        nonce,
        generation,
        secret,
      );
      const row = await tx.authEmailChallenge.update({
        where: { id: challenge.id },
        data: {
          nonce,
          generation,
          codeHash: RegistrationCode.digest(
            challenge.id,
            nonce,
            generation,
            code,
            secret,
          ),
          // Attempts are a budget for the whole challenge, never reset by resend.
          resendCount: { increment: 1 },
          sentAt: now,
          resendAvailableAt: new Date(now.getTime() + policy.cooldownMs),
        },
      });
      await this._enqueue(tx, row);
      return this._state(row);
    });
  }

  public async confirm(
    credentials: AuthFlowCredentials,
    input: { code: string; generation: number },
    context: RequestEvidenceV1,
  ): Promise<AuthFlowResponseV1> {
    FlowCredentials.validate(credentials);
    const secret = RegistrationCode.secret();
    const result = await this.prisma.$transaction(
      async (tx): Promise<AuthFlowResponseV1 | null> => {
        const challenge = await this.lock(tx, credentials);
        const existing = await this.store.find(tx, credentials);
        if (existing) return this.store.state(tx, existing);
        if (
          challenge.expiresAt <= new Date() ||
          challenge.failedAttempts >= challenge.maxAttempts ||
          challenge.hashKeyVersion !== RegistrationCode.keyVersion
        )
          return null;
        const sourceId = `${challenge.id}:${challenge.generation}`;
        if (challenge.consumedAt) {
          const proof = await tx.verifiedIdentityFact.findUnique({
            where: { method_sourceId: { method: "EMAIL_CODE", sourceId } },
          });
          if (!proof) return null;
          const owner = await this.directory.byEmail(tx, challenge.email);
          return owner && owner.status !== "active"
            ? null
            : { status: "LOGIN_REQUIRED", nextStep: "login" };
        }
        const expected = RegistrationCode.digest(
          challenge.id,
          challenge.nonce,
          challenge.generation,
          input.code,
          secret,
        );
        if (
          input.generation !== challenge.generation ||
          !PasswordHasher.equal(expected, challenge.codeHash)
        ) {
          const failedAttempts = challenge.failedAttempts + 1;
          await tx.authEmailChallenge.update({
            where: { id: challenge.id },
            data: {
              failedAttempts,
              ...(failedAttempts >= challenge.maxAttempts
                ? { consumedAt: new Date() }
                : {}),
            },
          });
          return null; // Commit the failed attempt before returning an error.
        }
        const now = new Date();
        await tx.authEmailChallenge.update({
          where: { id: challenge.id },
          data: { consumedAt: now },
        });
        const user = await this.directory.byEmail(tx, challenge.email);
        const proof = await tx.verifiedIdentityFact.create({
          data: {
            email: challenge.email,
            method: "EMAIL_CODE",
            sourceId,
            userIdSnapshot: user?.userId,
            verifiedAt: now,
            createdAt: now,
            requestContext: context as unknown as Prisma.InputJsonValue,
          },
        });
        if (user && user.status !== "active") return null;
        const accounts = user
          ? await tx.authAccount.findMany({
              where: { userId: user.userId },
              include: { credential: true },
            })
          : [];
        if (
          this.credentials.getEnvCredentialBinding(challenge.email) ||
          accounts.some(
            (account) =>
              account.credential || account.provider !== "CREDENTIALS",
          )
        )
          return { status: "LOGIN_REQUIRED", nextStep: "login" };
        const flow = await this.store.create(tx, {
          credentials,
          user,
          identityFactId: proof.id,
          method: "EMAIL_REGISTRATION",
          accountId: accounts[0]?.id ?? null,
          credentialUpdatedAt: null,
          context,
        });
        return this.store.state(tx, flow);
      },
    );
    if (!result)
      throw new BadRequestException("Invalid or expired verification code");
    return result;
  }

  public async readChallengeState(
    tx: Prisma.TransactionClient,
    challenge: AuthEmailChallenge,
  ): Promise<AuthFlowResponseV1> {
    if (challenge.expiresAt <= new Date())
      throw new UnauthorizedException(
        "Auth continuation is missing or expired",
      );
    if (challenge.consumedAt) {
      const proof = await tx.verifiedIdentityFact.findUnique({
        where: {
          method_sourceId: {
            method: "EMAIL_CODE",
            sourceId: `${challenge.id}:${challenge.generation}`,
          },
        },
      });
      if (proof) {
        const owner = await this.directory.byEmail(tx, challenge.email);
        if (!owner || owner.status === "active")
          return { status: "LOGIN_REQUIRED", nextStep: "login" };
      }
      throw new BadRequestException("Verification code attempts exceeded");
    }
    return this._state(challenge);
  }

  public async lock(
    tx: Prisma.TransactionClient,
    credentials: AuthFlowCredentials,
  ): Promise<AuthEmailChallenge> {
    const id = FlowCredentials.challengeId(credentials);
    await tx.$queryRaw`SELECT id FROM auth_email_challenges WHERE id = ${id} FOR UPDATE`;
    const row = await tx.authEmailChallenge.findUnique({ where: { id } });
    this._assertOwned(row, credentials);
    return row;
  }

  private _assertOwned(
    row: AuthEmailChallenge | null,
    credentials: AuthFlowCredentials,
  ): asserts row is AuthEmailChallenge {
    if (
      !row ||
      row.browserBindingHash !== FlowCredentials.browserHash(credentials)
    )
      throw new UnauthorizedException(
        "Auth continuation is missing or expired",
      );
  }

  private async _lockSend(
    tx: Prisma.TransactionClient,
    email: string,
    ipHash: string,
    secret: string,
  ): Promise<void> {
    for (const key of [
      RegistrationCode.hash(["registration-send", email], secret),
      ipHash,
    ].sort()) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
    }
  }

  private async _assertSendAllowed(
    tx: Prisma.TransactionClient,
    email: string,
    ipHash: string,
  ): Promise<void> {
    const policy = RegistrationPolicy.get();
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const rows = await tx.authEmailChallenge.findMany({
      where: { OR: [{ email }, { ipHash }], sentAt: { gte: since } },
    });
    const latest = rows
      .filter((row) => row.email === email)
      .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())[0];
    const emailSends = rows
      .filter((row) => row.email === email)
      .reduce((sum, row) => sum + row.resendCount + 1, 0);
    const ipSends = rows
      .filter((row) => row.ipHash === ipHash)
      .reduce((sum, row) => sum + row.resendCount + 1, 0);
    if (
      (latest && latest.resendAvailableAt.getTime() > Date.now()) ||
      emailSends >= policy.maxSends ||
      ipSends >= policy.ipMaxSends
    ) {
      throw new HttpException(
        {
          message: "Verification code resend is temporarily unavailable",
          retryAfterSeconds: latest
            ? Math.max(
                1,
                Math.ceil(
                  (latest.resendAvailableAt.getTime() - Date.now()) / 1000,
                ),
              )
            : 3600,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async _enqueue(
    tx: Prisma.TransactionClient,
    row: AuthEmailChallenge,
  ): Promise<void> {
    // Persisted Notifications command, committed with the challenge generation.
    const command = {
      kind: "email_registration",
      contractVersion: 1,
      challengeId: row.id,
      generation: row.generation,
    } satisfies RegistrationEmailCommandV1;
    await tx.notificationJob.create({
      data: {
        id: `registration:${row.id}:${row.generation}`,
        channel: "EMAIL",
        payload: { ...command },
      },
    });
  }

  private _state(row: AuthEmailChallenge): AuthFlowResponseV1 {
    const [local = "", domain = ""] = row.email.split("@");
    return {
      status: "PENDING",
      nextStep: "code",
      generation: row.generation,
      emailMasked: `${[...local][0] ?? ""}***@${domain}`,
      expiresAt: row.expiresAt.toISOString(),
      resendAvailableAt: row.resendAvailableAt.toISOString(),
    };
  }
}
