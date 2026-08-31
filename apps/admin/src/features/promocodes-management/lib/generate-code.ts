const promoCodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const promoCodeLength = 6;
const promoCodePrefix = "ARTM-";

export function generatePromoCode() {
  const randomBytes = crypto.getRandomValues(new Uint8Array(promoCodeLength));

  const randomSuffix = Array.from(
    randomBytes,
    (byte) => promoCodeAlphabet[byte % promoCodeAlphabet.length],
  ).join("");

  return `${promoCodePrefix}${randomSuffix}`;
}
