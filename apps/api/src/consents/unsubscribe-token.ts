import crypto from "node:crypto";

/** Revoke-only random capability. Raw tokens are returned once and never stored. */
export class UnsubscribeToken {
  public static create(): { token: string; hash: string } {
    const token = crypto.randomBytes(32).toString("base64url");
    return { token, hash: this.hash(token) };
  }
  public static valid(token: string): boolean {
    return (
      /^[A-Za-z0-9_-]{43}$/.test(token) &&
      Buffer.from(token, "base64url").toString("base64url") === token
    );
  }
  public static hash(token: string): string {
    return crypto
      .createHash("sha256")
      .update(`artmate:email-advertising:unsubscribe:v1:${token}`)
      .digest("hex");
  }
}
