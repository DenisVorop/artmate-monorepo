const excludedRoots = ["/auth", "/account", "/cart", "/checkout", "/legal"];

export function isWelcomeBonusPathEligible(pathname: string) {
  return !excludedRoots.some((root) => pathname === root || pathname.startsWith(`${root}/`));
}
