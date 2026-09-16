const promoCodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const promoCodeLength = 6;

export function generateAffiliateCode() {
  const randomBytes = crypto.getRandomValues(new Uint8Array(promoCodeLength));
  const suffix = Array.from(
    randomBytes,
    (byte) => promoCodeAlphabet[byte % promoCodeAlphabet.length],
  ).join("");

  return `ARTM-${suffix}`;
}
