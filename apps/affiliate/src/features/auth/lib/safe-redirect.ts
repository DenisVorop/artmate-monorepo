export function getSafeRedirectPath(path?: string) {
  return path === "/codes" || path === "/cooperation" ? path : "/";
}
