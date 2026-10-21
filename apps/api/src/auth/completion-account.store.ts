import type {
  Prisma,
  AuthPendingFlow,
  AuthAuthenticationFact,
} from "../generated/prisma/client";
import type { CustomerAuthDirectoryV1 } from "../users/contracts/auth-directory.contract";
import { SessionAccountBinding } from "./session-account-binding";

/** Auth-owned credential/provider account CAS. The final transaction retains
 * its locks through completion, so neither linking nor a password precedes it. */
export class CompletionAccountStore {
  public static async resolve(
    tx: Prisma.TransactionClient,
    flow: AuthPendingFlow,
    auth: AuthAuthenticationFact,
    user: CustomerAuthDirectoryV1,
    now: Date,
    replay: boolean,
    envCredentialBinding: string | undefined,
  ) {
    const key = `auth-completion:${user.userId}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
    await tx.$queryRaw`SELECT id FROM auth_accounts WHERE user_id = ${user.userId} FOR UPDATE`;
    const accounts = await tx.authAccount.findMany({
      where: { userId: user.userId },
      include: { credential: true },
    });
    const bound = accounts.find(
      (account) => account.id === auth.accountIdSnapshot,
    );
    if (auth.method === "YANDEX") {
      if (!auth.providerUserIdSnapshot) return null;
      const providerKey = `auth-yandex-link:${auth.providerUserIdSnapshot}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${providerKey}, 0))`;
      const linked = await tx.authAccount.findUnique({
        where: {
          provider_providerUserId: {
            provider: "YANDEX",
            providerUserId: auth.providerUserIdSnapshot,
          },
        },
        include: { credential: true },
      });
      if (auth.accountIdSnapshot)
        return bound?.provider === "YANDEX" &&
          bound.providerUserId === auth.providerUserIdSnapshot &&
          bound.userId === user.userId
          ? bound
          : null;
      if (linked) return linked.userId === user.userId ? linked : null;
      if (replay || accounts.some((account) => account.provider === "YANDEX"))
        return null;
      return tx.authAccount.create({
        include: { credential: true },
        data: {
          provider: "YANDEX",
          providerUserId: auth.providerUserIdSnapshot,
          providerEmail: user.email,
          userId: user.userId,
          connectedAt: now,
        },
      });
    }
    if (auth.method === "SESSION")
      return SessionAccountBinding.matches(
        auth,
        bound ?? null,
        envCredentialBinding,
      )
        ? bound!
        : null;
    if (auth.method === "PASSWORD")
      return bound?.provider === "CREDENTIALS" &&
        bound.providerUserId === user.email &&
        bound.credential?.passwordUpdatedAt.getTime() ===
          auth.credentialUpdatedAt?.getTime()
        ? bound
        : null;
    if (auth.method === "ENV_PASSWORD")
      return bound &&
        bound.provider === "CREDENTIALS" &&
        bound.providerUserId === user.email &&
        !bound.credential &&
        envCredentialBinding === auth.envCredentialBindingSnapshot
        ? bound
        : null;
    if (
      auth.method !== "EMAIL_REGISTRATION" &&
      auth.method !== "ORDER_ACTIVATION"
    )
      return null;
    if (replay)
      return (
        accounts.find(
          (account) =>
            account.provider === "CREDENTIALS" &&
            account.providerUserId === user.email &&
            account.credential?.passwordUpdatedAt.getTime() === now.getTime(),
        ) ?? null
      );
    if (
      flow.expiresAt <= new Date() ||
      !flow.credentialPasswordHash ||
      !flow.credentialExpiresAt ||
      flow.credentialExpiresAt <= new Date() ||
      flow.credentialOperationKey === null ||
      accounts.some(
        (account) =>
          account.credential ||
          account.provider !== "CREDENTIALS" ||
          account.providerUserId !== user.email,
      ) ||
      envCredentialBinding ||
      (auth.accountIdSnapshot && !bound)
    )
      return null;
    const account =
      accounts.find(
        (item) =>
          item.provider === "CREDENTIALS" && item.providerUserId === user.email,
      ) ??
      (await tx.authAccount.create({
        include: { credential: true },
        data: {
          userId: user.userId,
          provider: "CREDENTIALS",
          providerUserId: user.email!,
          providerEmail: user.email,
          connectedAt: now,
        },
      }));
    await tx.authCredential.create({
      data: {
        accountId: account.id,
        passwordHash: flow.credentialPasswordHash,
        passwordUpdatedAt: now,
      },
    });
    return account;
  }
}
