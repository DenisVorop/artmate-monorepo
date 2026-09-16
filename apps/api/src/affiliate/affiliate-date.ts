const moscowDateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Europe/Moscow",
  year: "numeric",
});

export function isAffiliateContractDateInFuture(
  signedAt: Date,
  now = new Date(),
) {
  const todayParts = Object.fromEntries(
    moscowDateFormatter
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  const signedDate =
    signedAt.getUTCFullYear() * 10_000 +
    (signedAt.getUTCMonth() + 1) * 100 +
    signedAt.getUTCDate();
  const today =
    Number(todayParts.year) * 10_000 +
    Number(todayParts.month) * 100 +
    Number(todayParts.day);

  return signedDate > today;
}
