import crypto from "node:crypto";
import { InternalServerErrorException } from "@nestjs/common";

/** Versioned Auth delivery protocol: only HMACs/nonce are persisted. Derivation
 * allows the existing Notifications worker to deliver a committed outbox job.
 * The secret is purpose-specific and is never the JWT signing key.
 */
export class RegistrationCode {
  public static readonly keyVersion = "v1";

  public static secret(): string {
    const secret = process.env.AUTH_EMAIL_VERIFICATION_SECRET?.trim();
    if (!secret)
      throw new InternalServerErrorException(
        "AUTH_EMAIL_VERIFICATION_SECRET is not configured",
      );
    return secret;
  }

  public static derive(
    id: string,
    nonce: string,
    generation: number,
    secret: string,
  ): string {
    const digest = this.hash(
      ["registration-code-value-v1", id, nonce, generation],
      secret,
    );
    return (BigInt(`0x${digest}`) % 1_000_000n).toString().padStart(6, "0");
  }

  public static digest(
    id: string,
    nonce: string,
    generation: number,
    code: string,
    secret: string,
  ): string {
    return this.hash(
      ["registration-code-proof-v1", id, nonce, generation, code],
      secret,
    );
  }

  public static hash(value: readonly unknown[], secret: string): string {
    return crypto
      .createHmac("sha256", secret)
      .update(JSON.stringify(value))
      .digest("hex");
  }

  public static binding(value: string): string {
    return crypto.createHash("sha256").update(value).digest("hex");
  }
}
