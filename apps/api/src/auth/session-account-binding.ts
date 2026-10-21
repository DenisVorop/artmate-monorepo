import crypto from "node:crypto";
import type {
  AuthAuthenticationFact,
  AuthProvider,
} from "../generated/prisma/client";

interface SessionAccount {
  readonly id: string;
  readonly userId: string;
  readonly provider: AuthProvider;
  readonly providerUserId: string;
  readonly credential: { readonly passwordUpdatedAt: Date } | null;
}

/** A credential/provider change invalidates a pending session continuation even
 * when an old access token has not reached its natural expiry yet. */
export class SessionAccountBinding {
  public static hash(
    account: SessionAccount,
    envBinding?: string,
  ): string | null {
    if (
      account.provider === "CREDENTIALS" &&
      !account.credential &&
      !envBinding
    )
      return null;
    return crypto
      .createHash("sha256")
      .update(
        JSON.stringify({
          accountId: account.id,
          userId: account.userId,
          provider: account.provider,
          providerUserId: account.providerUserId,
          credentialUpdatedAt:
            account.credential?.passwordUpdatedAt.toISOString() ?? null,
          envBinding:
            account.provider === "CREDENTIALS" && !account.credential
              ? envBinding
              : null,
        }),
      )
      .digest("hex");
  }

  public static matches(
    auth: AuthAuthenticationFact,
    account: SessionAccount | null,
    envBinding?: string,
  ): boolean {
    return (
      !!account &&
      auth.method === "SESSION" &&
      account.id === auth.accountIdSnapshot &&
      account.userId === auth.userIdSnapshot &&
      this.hash(account, envBinding) === auth.sessionAccountBindingSnapshot
    );
  }
}
