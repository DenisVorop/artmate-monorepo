import crypto from "node:crypto";
import { InternalServerErrorException } from "@nestjs/common";

/** Existing Artmate scrypt format, shared by legacy credentials and Auth flows. */
export class PasswordHasher {
  public static async create(password: string): Promise<string> {
    const salt = crypto.randomBytes(16).toString("hex");
    return `scrypt:${salt}:${await this._derive(password, salt)}`;
  }

  public static async verify(
    password: string,
    encoded: string,
  ): Promise<boolean> {
    const { salt, hash } = this.assertValid(encoded);
    return this.equal(await this._derive(password, salt), hash);
  }

  public static assertValid(encoded: string): { salt: string; hash: string } {
    const [algorithm, salt, hash, extra] = encoded.split(":");
    if (algorithm !== "scrypt" || !salt || !hash || extra !== undefined) {
      throw new InternalServerErrorException(
        "AUTH_PASSWORD_HASH must use format scrypt:<salt>:<hash>",
      );
    }
    return { salt, hash };
  }

  public static equal(actual: string, expected: string): boolean {
    const a = Buffer.from(actual);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  private static _derive(password: string, salt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      crypto.scrypt(password, salt, 64, (error, key) => {
        if (error) reject(error);
        else resolve(key.toString("hex"));
      });
    });
  }
}
