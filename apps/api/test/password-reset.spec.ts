import assert from "node:assert/strict";
import crypto from "node:crypto";
import { describe, it } from "node:test";

import { BadRequestException, Logger } from "@nestjs/common";

import { PasswordResetService } from "../src/auth/password-reset.service";
import { createPasswordResetToken } from "../src/auth/password-reset-token";
import {
  NotificationJobChannel,
  NotificationJobStatus,
  UserStatus,
} from "../src/generated/prisma/client";
import type { MailerService } from "../src/mailer/mailer.service";
import { NotificationQueueService } from "../src/notifications/notification-queue.service";
import type { PrismaService } from "../src/prisma/prisma.service";

describe("password reset delivery", () => {
  it("commits a reset token and email job without calling SMTP in the request path", async () => {
    const fixture = createFixture();

    const response = await fixture.service.requestReset({
      email: " Buyer@Example.COM ",
      ipAddress: "203.0.113.1",
    });

    assert.deepEqual(response, { ok: true });
    assert.equal(fixture.smtpCalls(), 0);
    assert.equal(fixture.tokens.length, 1);
    assert.equal(fixture.jobs.length, 1);
    assert.equal(fixture.enqueueWriters[0], fixture.tx);
    assert.deepEqual(Object.keys(fixture.jobs[0]!.payload).sort(), [
      "kind",
      "passwordResetTokenId",
      "recipient",
    ]);
    assert.deepEqual(fixture.jobs[0]!.payload, {
      kind: "password_reset",
      passwordResetTokenId: fixture.tokens[0]!.id,
      recipient: "buyer@example.com",
    });
    assert.doesNotMatch(
      JSON.stringify(fixture.jobs[0]!.payload),
      /token=|https?:\/\/|reset-password|"(?:html|text|token)"/iu,
    );
  });

  it("rolls back token invalidation and creation when the email job insert fails", async () => {
    const activeToken = {
      consumedAt: null as Date | null,
      expiresAt: new Date(Date.now() + 60_000),
      id: "existing-token",
      ipAddress: null as string | null,
      sentAt: new Date(Date.now() - 120_000),
      tokenHash: "existing-hash",
      userId: "user-1",
    };
    const fixture = createFixture({ activeToken, enqueueError: new Error("job insert failed") });

    await assert.rejects(
      fixture.service.requestReset({ email: "buyer@example.com" }),
      /job insert failed/u,
    );

    assert.equal(fixture.tokens.length, 1);
    assert.equal(fixture.tokens[0]?.id, activeToken.id);
    assert.equal(fixture.tokens[0]?.consumedAt, null);
    assert.equal(fixture.jobs.length, 0);
  });

  it("keeps known and unknown responses generic while SMTP failure is retried by the worker", async () => {
    const known = createFixture();
    const unknown = createFixture({ accountExists: false });

    const knownResponse = await known.service.requestReset({ email: "buyer@example.com" });
    const unknownResponse = await unknown.service.requestReset({ email: "unknown@example.com" });

    assert.deepEqual(knownResponse, { ok: true });
    assert.deepEqual(knownResponse, unknownResponse);
    assert.equal(known.smtpCalls(), 0);

    const queuedJob = known.jobs[0];
    assert.ok(queuedJob);
    const updates: Array<Record<string, unknown>> = [];
    const storedToken = known.tokens[0];
    assert.ok(storedToken);
    const worker = createResetWorker(
      storedToken,
      {
        sendMail: async () => {
          throw new Error("SMTP unavailable");
        },
      },
      "active",
      (data) => updates.push(data),
    );

    await worker.processJob(queuedJob);

    assert.equal(updates.length, 1);
    assert.equal(updates[0]?.attempts, 1);
    assert.equal(updates[0]?.status, NotificationJobStatus.PENDING);
    assert.ok(updates[0]?.nextAttemptAt instanceof Date);
  });

  it("reconstructs a confirmable reset link only in the worker", async () => {
    const fixture = createFixture();
    await fixture.service.requestReset({ email: "buyer@example.com" });
    const storedToken = fixture.tokens[0];
    assert.ok(storedToken);

    let sentText = "";
    const worker = createResetWorker(storedToken, {
      sendMail: async (mail) => {
        sentText = mail.text;
      },
    });

    await worker.dispatchJob(createResetJob(storedToken.id));

    const resetUrl = sentText
      .split("\n")
      .find((line) => line.includes("/auth/reset-password?"))
      ?.split(": ")
      .at(-1);
    assert.ok(resetUrl);
    const rawToken = new URL(resetUrl).searchParams.get("token");
    assert.ok(rawToken);
    assert.equal(createResetTokenHash(rawToken), storedToken.tokenHash);
  });

  it("skips tampered, expired and consumed reset jobs", async () => {
    const activeToken: StoredToken = {
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      id: "reset-token-1",
      ipAddress: null,
      sentAt: new Date(),
      tokenHash: "tampered-hash",
      userId: "user-1",
    };

    for (const token of [
      activeToken,
      { ...activeToken, consumedAt: new Date() },
      { ...activeToken, expiresAt: new Date(Date.now() - 1_000) },
    ]) {
      let sends = 0;
      const worker = createResetWorker(token, {
        sendMail: async () => {
          sends += 1;
        },
      });

      await worker.dispatchJob(createResetJob(token.id));

      assert.equal(sends, 0);
    }
  });

  it("skips reset jobs after the account loses eligibility", async () => {
    const fixture = createFixture();
    await fixture.service.requestReset({ email: "buyer@example.com" });
    const token = fixture.tokens[0];
    assert.ok(token);

    for (const eligibility of ["blocked", "missing-credential"] as const) {
      let sends = 0;
      const worker = createResetWorker(
        token,
        {
          sendMail: async () => {
            sends += 1;
          },
        },
        eligibility,
      );

      await worker.dispatchJob(createResetJob(token.id));

      assert.equal(sends, 0);
    }
  });

  it("does not expose reset recipients or tokens in log-only mail output", async (t) => {
    const logs: unknown[][] = [];
    const previousLogOnly = process.env.MAIL_LOG_ONLY;
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.MAIL_LOG_ONLY = "true";
    process.env.NODE_ENV = "test";
    t.mock.method(console, "info", (...args: unknown[]) => logs.push(args));

    try {
      await new (await import("../src/mailer/mailer.service")).MailerService().sendMail({
        subject: "Reset",
        text: "https://artmate.example/auth/reset-password?token=raw-secret",
        to: "buyer@example.com",
      });
    } finally {
      if (previousLogOnly === undefined) delete process.env.MAIL_LOG_ONLY;
      else process.env.MAIL_LOG_ONLY = previousLogOnly;
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
    }

    assert.equal(logs.length, 1);
    assert.doesNotMatch(JSON.stringify(logs), /buyer@example\.com|raw-secret|token=/iu);
  });

  it("redacts all email errors from queue state and logs while preserving Telegram diagnostics", async (t) => {
    const logs: unknown[][] = [];
    const updates: Array<Record<string, unknown>> = [];
    t.mock.method(Logger.prototype, "warn", (...args: unknown[]) => logs.push(args));
    const worker = new NotificationQueueService(
      {
        sendMail: async () => undefined,
      } as unknown as MailerService,
      {
        notificationJob: {
          update: async ({ data }: { data: Record<string, unknown> }) => {
            updates.push(data);
          },
        },
      } as unknown as PrismaService,
    ) as unknown as {
      markJobFailed(job: unknown, error: unknown): Promise<void>;
    };
    const secretError = new Error(
      "SMTP rejected buyer@example.com for https://artmate.example/auth/reset-password?token=raw-secret",
    );

    for (const payload of [
      createResetJob("reset-token-1").payload,
      {
        activationTokenId: "activation-token-1",
        email: "buyer@example.com",
        kind: "order_activation",
      },
      {
        subject: "Order for buyer@example.com",
        text: "token=raw-secret",
        to: "buyer@example.com",
      },
    ]) {
      await worker.markJobFailed(
        {
          attempts: 0,
          channel: NotificationJobChannel.EMAIL,
          id: `email-job-${updates.length + 1}`,
          maxAttempts: 5,
          nextAttemptAt: new Date(),
          payload,
        },
        secretError,
      );
    }

    await worker.markJobFailed(
      {
        attempts: 0,
        channel: NotificationJobChannel.TELEGRAM,
        id: "telegram-job-1",
        maxAttempts: 5,
        nextAttemptAt: new Date(),
        payload: { bot: "orders", chatId: "123", text: "order" },
      },
      secretError,
    );

    assert.deepEqual(
      updates.slice(0, 3).map((update) => update.lastError),
      Array(3).fill("Email notification delivery failed"),
    );
    const emailDiagnostics = JSON.stringify([updates.slice(0, 3), logs.slice(0, 3)]);
    assert.doesNotMatch(
      emailDiagnostics,
      /buyer@example\.com|raw-secret|token=/iu,
    );
    assert.equal(updates[3]?.lastError, secretError.message);
    assert.match(JSON.stringify(logs[3]), /buyer@example\.com|raw-secret|token=/iu);
  });
});

describe("password reset confirmation", () => {
  it("allows only one of two parallel confirmations for the same link", async () => {
    const fixture = createConfirmFixture();

    const results = await Promise.allSettled([
      fixture.service.confirmReset({
        password: "first-password",
        token: fixture.rawToken,
      }),
      fixture.service.confirmReset({
        password: "second-password",
        token: fixture.rawToken,
      }),
    ]);

    assert.equal(
      results.filter((result) => result.status === "fulfilled").length,
      1,
    );
    const rejected = results.find((result) => result.status === "rejected");
    assert.ok(rejected && rejected.status === "rejected");
    assert.ok(rejected.reason instanceof BadRequestException);
    assert.equal(
      (rejected.reason as BadRequestException).message,
      "Password reset link is invalid or expired",
    );
    assert.equal(fixture.credentialUpdateCount(), 1);
    assert.equal(fixture.authVersion(), 1);
    assert.match(fixture.passwordHash(), /^hashed:(?:first|second)-password$/u);
  });

  it("rejects a user that becomes blocked or deleted before the locked re-read", async () => {
    for (const status of [UserStatus.BLOCKED, UserStatus.DELETED]) {
      const fixture = createConfirmFixture({ statusAfterInitialLookup: status });

      await assert.rejects(
        fixture.service.confirmReset({
          password: "attacker-password",
          token: fixture.rawToken,
        }),
        (error: unknown) =>
          error instanceof BadRequestException &&
          error.message === "Password reset link is invalid or expired",
      );
      assert.equal(fixture.credentialUpdateCount(), 0);
      assert.equal(fixture.authVersion(), 0);
      assert.equal(fixture.passwordHash(), "existing-password-hash");
    }
  });
});

type StoredToken = {
  consumedAt: Date | null;
  expiresAt: Date;
  id: string;
  ipAddress: string | null;
  sentAt: Date;
  tokenHash: string;
  userId: string;
};

function createConfirmFixture(options: {
  statusAfterInitialLookup?: UserStatus;
} = {}) {
  const rawToken = createPasswordResetToken(
    "reset-token-1",
    "test-password-reset-secret",
  );
  const token: StoredToken = {
    consumedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    id: "reset-token-1",
    ipAddress: null,
    sentAt: new Date(),
    tokenHash: createResetTokenHash(rawToken),
    userId: "user-1",
  };
  let userStatus: UserStatus = UserStatus.ACTIVE;
  let passwordHash = "existing-password-hash";
  let authVersion = 0;
  let credentialUpdateCount = 0;
  let transactionTail = Promise.resolve();
  const tx = {
    $queryRaw: async () => [{ id: "locked-row" }],
    authAccount: {
      findFirst: async () => ({
        credential: { id: "credential-1" },
        id: "account-1",
        userId: token.userId,
      }),
    },
    authCredential: {
      update: async ({ data }: { data: { passwordHash: string } }) => {
        passwordHash = data.passwordHash;
        credentialUpdateCount += 1;
      },
    },
    authPasswordResetToken: {
      findUnique: async () => ({ ...token }),
      updateMany: async ({ data, where }: {
        data: { consumedAt: Date };
        where: {
          consumedAt?: null;
          id?: string;
          tokenHash?: string;
          userId?: string;
        };
      }) => {
        const matches =
          (!where.id || where.id === token.id) &&
          (!where.tokenHash || where.tokenHash === token.tokenHash) &&
          (!where.userId || where.userId === token.userId) &&
          (where.consumedAt !== null || token.consumedAt === null);
        if (matches) token.consumedAt = data.consumedAt;
        return { count: matches ? 1 : 0 };
      },
    },
    user: {
      findUnique: async () => ({ status: userStatus }),
      update: async ({ data }: { data: { authVersion: { increment: number } } }) => {
        authVersion += data.authVersion.increment;
        return { authVersion, status: userStatus };
      },
    },
  };
  const prisma = {
    $transaction: async <T>(callback: (writer: typeof tx) => Promise<T>) => {
      const previous = transactionTail;
      let releaseTransaction!: () => void;
      transactionTail = new Promise<void>((resolve) => {
        releaseTransaction = resolve;
      });
      await previous;
      const snapshot = {
        consumedAt: token.consumedAt,
        credentialUpdateCount,
        passwordHash,
        authVersion,
      };
      try {
        return await callback(tx);
      } catch (error) {
        token.consumedAt = snapshot.consumedAt;
        credentialUpdateCount = snapshot.credentialUpdateCount;
        passwordHash = snapshot.passwordHash;
        authVersion = snapshot.authVersion;
        throw error;
      } finally {
        releaseTransaction();
      }
    },
    authPasswordResetToken: {
      findUnique: async () => {
        const initialToken = {
          ...token,
          user: { status: UserStatus.ACTIVE },
        };
        userStatus = options.statusAfterInitialLookup ?? userStatus;
        return initialToken;
      },
    },
  } as unknown as PrismaService;
  const credentialsAuthService = {
    createPasswordHash: async (password: string) => `hashed:${password}`,
  };
  process.env.AUTH_PASSWORD_RESET_SECRET = "test-password-reset-secret";

  return {
    authVersion: () => authVersion,
    credentialUpdateCount: () => credentialUpdateCount,
    passwordHash: () => passwordHash,
    rawToken,
    service: new PasswordResetService(
      credentialsAuthService as never,
      {} as NotificationQueueService,
      prisma,
    ),
  };
}

function createFixture(options: {
  accountExists?: boolean;
  activeToken?: StoredToken;
  enqueueError?: Error;
} = {}) {
  const tokens: StoredToken[] = options.activeToken ? [{ ...options.activeToken }] : [];
  const jobs: Array<Record<string, unknown> & { payload: Record<string, unknown> }> = [];
  const enqueueWriters: unknown[] = [];
  let smtpCalls = 0;
  const tx = {
    authPasswordResetToken: {
      count: async () => tokens.length,
      create: async ({ data }: { data: Omit<StoredToken, "id"> & { id?: string } }) => {
        const token = { ...data, id: data.id ?? `token-${tokens.length + 1}` };
        tokens.push(token);
        return token;
      },
      findFirst: async () =>
        [...tokens].sort((left, right) => right.sentAt.getTime() - left.sentAt.getTime())[0] ??
        null,
      updateMany: async ({ data }: { data: { consumedAt: Date } }) => {
        for (const token of tokens) {
          if (!token.consumedAt) token.consumedAt = data.consumedAt;
        }
        return { count: tokens.length };
      },
    },
    notificationJob: {
      create: async ({ data }: { data: { payload: Record<string, unknown> } }) => {
        if (options.enqueueError) throw options.enqueueError;
        const job = {
          attempts: 0,
          channel: NotificationJobChannel.EMAIL,
          createdAt: new Date(),
          failedAt: null,
          id: `job-${jobs.length + 1}`,
          lastError: null,
          lockedAt: null,
          maxAttempts: 5,
          nextAttemptAt: new Date(),
          sentAt: null,
          status: NotificationJobStatus.PENDING,
          ...data,
        };
        jobs.push(job);
        return job;
      },
    },
  };
  const prisma = {
    $transaction: async <T>(callback: (writer: typeof tx) => Promise<T>) => {
      const tokenSnapshot = tokens.map((token) => ({ ...token }));
      const jobSnapshot = jobs.map((job) => ({ ...job }));
      try {
        return await callback(tx);
      } catch (error) {
        tokens.splice(0, tokens.length, ...tokenSnapshot);
        jobs.splice(0, jobs.length, ...jobSnapshot);
        throw error;
      }
    },
    authAccount: {
      findFirst: async () =>
        options.accountExists === false
          ? null
          : {
              credential: { id: "credential-1" },
              user: {
                email: "buyer@example.com",
                id: "user-1",
                status: UserStatus.ACTIVE,
              },
            },
    },
    authPasswordResetToken: tx.authPasswordResetToken,
  } as unknown as PrismaService;
  const notifications = {
    enqueuePasswordReset: async (input: Record<string, unknown>, writer: typeof tx) => {
      enqueueWriters.push(writer);
      return writer.notificationJob.create({
        data: { payload: { kind: "password_reset", ...input } },
      });
    },
    sendMail: async () => {
      smtpCalls += 1;
      throw new Error("SMTP must not run in the request path");
    },
  } as unknown as NotificationQueueService & MailerService;
  process.env.AUTH_PASSWORD_RESET_SECRET = "test-password-reset-secret";
  process.env.SITE_URL = "https://artmate.example";

  return {
    enqueueWriters,
    jobs,
    service: new PasswordResetService(
      {} as never,
      notifications,
      prisma,
    ),
    smtpCalls: () => smtpCalls,
    tokens,
    tx,
  };
}

function createResetJob(passwordResetTokenId: string) {
  return {
    attempts: 0,
    channel: NotificationJobChannel.EMAIL,
    id: "reset-job-1",
    maxAttempts: 5,
    nextAttemptAt: new Date(),
    payload: {
      kind: "password_reset",
      passwordResetTokenId,
      recipient: "buyer@example.com",
    },
  };
}

function createResetTokenHash(token: string) {
  return crypto
    .createHmac("sha256", "test-password-reset-secret")
    .update(`password-reset:${token}`)
    .digest("hex");
}

function createResetWorker(
  token: StoredToken,
  mailer: Pick<MailerService, "sendMail">,
  eligibility: "active" | "blocked" | "missing-credential" = "active",
  onJobUpdate?: (data: Record<string, unknown>) => void,
) {
  const tx = {
    $queryRaw: async () => [],
    authAccount: {
      findFirst: async () =>
        eligibility === "missing-credential"
          ? null
          : { credential: { id: "credential-1" } },
    },
    authPasswordResetToken: {
      findUnique: async () => token,
    },
    user: {
      findUnique: async () => ({
        status:
          eligibility === "blocked" ? UserStatus.BLOCKED : UserStatus.ACTIVE,
      }),
    },
  };
  const runtimeMailer = {
    createPasswordResetEmail: (
      recipient: string,
      resetUrl: string,
      ttlMinutes: number,
    ) => ({
      subject: "Reset",
      text: `Reset: ${resetUrl}\nTTL: ${ttlMinutes}`,
      to: recipient,
    }),
    ...mailer,
  } as unknown as MailerService;

  return new NotificationQueueService(runtimeMailer, {
    ...tx,
    $transaction: async <T>(callback: (writer: typeof tx) => Promise<T>) =>
      callback(tx),
    notificationJob: {
      update: async ({ data }: { data: Record<string, unknown> }) => {
        onJobUpdate?.(data);
      },
    },
  } as unknown as PrismaService) as unknown as {
    dispatchJob(job: unknown): Promise<void>;
    processJob(job: unknown): Promise<void>;
  };
}
