import crypto from "node:crypto";

const activationTokenIdPattern = /^[A-Za-z0-9_-]{24}$/;
const signaturePurpose = "artmate:order-activation:signature";
const hashPurpose = "artmate:order-activation:token-hash";

export function createOrderActivationTokenId() {
  return crypto.randomBytes(18).toString("base64url");
}

export function createOrderActivationToken(tokenId: string, secret: string) {
  if (!activationTokenIdPattern.test(tokenId)) {
    throw new Error("Order activation token id is invalid");
  }

  return `${tokenId}.${createHmac(secret, `${signaturePurpose}:${tokenId}`)}`;
}

export function verifyOrderActivationToken(token: string, secret: string) {
  const [tokenId, signature, extra] = token.split(".");
  if (
    extra !== undefined ||
    !tokenId ||
    !signature ||
    !activationTokenIdPattern.test(tokenId)
  ) {
    return undefined;
  }

  const expected = createHmac(secret, `${signaturePurpose}:${tokenId}`);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return undefined;
  }

  return tokenId;
}

export function createOrderActivationTokenHash(
  token: string,
  secret: string,
) {
  return createHmac(secret, `${hashPurpose}:${token}`);
}

function createHmac(secret: string, value: string) {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}
