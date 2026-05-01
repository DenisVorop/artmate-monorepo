const nextImageBypassHosts = ["ozone.ru"];

export function shouldBypassNextImageOptimization(src: string) {
  try {
    const hostname = new URL(src).hostname;

    return nextImageBypassHosts.some(
      (host) => hostname === host || hostname.endsWith(`.${host}`),
    );
  } catch {
    return false;
  }
}
