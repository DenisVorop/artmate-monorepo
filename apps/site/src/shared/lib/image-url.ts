const nextImageBypassHosts = ["ozone.ru"];

export function ozonImageLoader({ src, width }: { src: string; width: number }) {
  const url = new URL(src);
  // Ozon's wc size limits the longest edge; product covers have a 3:4 aspect ratio.
  const longestEdge = Math.ceil((width * 4) / 3);
  url.pathname = url.pathname.replace(
    /^(\/s3\/[^/]+\/)(?:wc\d+\/)?([^/]+)$/,
    `$1wc${longestEdge}/$2`,
  );
  return url.href;
}

export function shouldBypassNextImageOptimization(src: string) {
  try {
    const hostname = new URL(src).hostname;

    return nextImageBypassHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}
