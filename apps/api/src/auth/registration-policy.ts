import { InternalServerErrorException } from "@nestjs/common";

export class RegistrationPolicy {
  public static get() {
    return {
      ttlMs:
        this._positive("AUTH_EMAIL_VERIFICATION_CODE_TTL_SECONDS", 600) * 1000,
      cooldownMs:
        this._positive("AUTH_EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS", 60) *
        1000,
      maxAttempts: this._positive("AUTH_EMAIL_VERIFICATION_MAX_ATTEMPTS", 5),
      maxSends: this._positive("AUTH_EMAIL_VERIFICATION_MAX_SENDS_PER_HOUR", 5),
      ipMaxSends: this._positive(
        "AUTH_EMAIL_VERIFICATION_IP_MAX_SENDS_PER_HOUR",
        20,
      ),
      flowTtlMs: 15 * 60 * 1000,
    };
  }

  private static _positive(name: string, fallback: number): number {
    const raw = process.env[name]?.trim();
    const value = raw ? Number(raw) : fallback;
    if (!Number.isSafeInteger(value) || value <= 0)
      throw new InternalServerErrorException(
        `${name} must be a positive integer`,
      );
    return value;
  }
}
