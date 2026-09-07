import crypto from "node:crypto";

const signaturePurpose = "artmate:password-reset:signature";
const hashPurpose = "password-reset";

export function createPasswordResetTokenId() {
  return crypto.randomBytes(18).toString("base64url");
}

export function createPasswordResetToken(tokenId: string, secret: string) {
  return `${tokenId}.${createHmac(secret, `${signaturePurpose}:${tokenId}`)}`;
}

export function createPasswordResetTokenHash(token: string, secret: string) {
  return createHmac(secret, `${hashPurpose}:${token}`);
}

function createHmac(secret: string, value: string) {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}
