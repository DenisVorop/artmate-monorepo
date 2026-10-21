import type { RegistrationEmailCommandV1 } from "../contracts/registration-email-command.contract";
import { RegistrationCode } from "../../auth/registration-code";
import { EmailVerificationMessage } from "../../auth/email-verification-message";
import type { PrismaService } from "../../prisma/prisma.service";
import type { SendMailInput } from "../../mailer/mailer.service";

/** Notifications integration with the Auth-owned delivery publication/protocol.
 * Reads only the published transport view; never invokes an Auth business service.
 */
export class RegistrationEmailAdapter {
  public static async prepare(
    reader: Pick<PrismaService, "$queryRaw">,
    payload: Record<string, unknown>,
  ): Promise<SendMailInput | null> {
    if (
      payload.kind !== "email_registration" ||
      payload.contractVersion !== 1 ||
      typeof payload.challengeId !== "string" ||
      typeof payload.generation !== "number" ||
      !Number.isSafeInteger(payload.generation) ||
      payload.generation < 1
    )
      throw new Error("Invalid registration notification contract");
    const command = {
      kind: "email_registration",
      contractVersion: 1,
      challengeId: payload.challengeId,
      generation: payload.generation,
    } satisfies RegistrationEmailCommandV1;
    const rows = await reader.$queryRaw<
      {
        challengeId: string;
        email: string;
        nonce: string;
        generation: number;
        hashKeyVersion: string;
        expiresAt: Date;
        consumedAt: Date | null;
      }[]
    >`SELECT challenge_id AS "challengeId", email, nonce, generation, hash_key_version AS "hashKeyVersion",
        expires_at AS "expiresAt", consumed_at AS "consumedAt"
      FROM auth_registration_deliveries_v1 WHERE challenge_id = ${command.challengeId}`;
    const row = rows[0];
    if (
      !row ||
      row.consumedAt ||
      row.expiresAt <= new Date() ||
      row.generation !== command.generation
    )
      return null;
    if (row.hashKeyVersion !== RegistrationCode.keyVersion)
      throw new Error("Unsupported registration notification key version");
    return EmailVerificationMessage.create(
      row.email,
      RegistrationCode.derive(
        row.challengeId,
        row.nonce,
        row.generation,
        RegistrationCode.secret(),
      ),
      Math.max(1, Math.ceil((row.expiresAt.getTime() - Date.now()) / 60_000)),
    );
  }
}
