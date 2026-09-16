export function formatAffiliateCodeCount(count: number) {
  const lastTwoDigits = count % 100;
  const lastDigit = count % 10;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return `${count} промокодов`;
  }

  if (lastDigit === 1) {
    return `${count} промокод`;
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return `${count} промокода`;
  }

  return `${count} промокодов`;
}
