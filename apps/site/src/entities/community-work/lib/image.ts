const publicImageWidths = [160, 240, 320, 480, 640, 800, 960, 1200];

export function getPublicAssetSrcSet(src: string) {
  return publicImageWidths
    .map((width) => {
      const url = new URL(src);
      url.searchParams.set("width", String(width));
      return `${url.href} ${width}w`;
    })
    .join(", ");
}
