export function getSafeRedirectPath(path?: string) {
  return path === "/cooperation" ? path : "/";
}
