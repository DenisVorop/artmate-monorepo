const publicImageWidths = [
  160, 200, 240, 280, 320, 360, 400, 440, 480, 520, 560, 600, 640, 680, 720, 760, 800, 880, 960,
  1080, 1200,
];

export function getPublicAssetSrcSet(src: string) {
  return publicImageWidths
    .map((width) => {
      const url = new URL(src);
      url.searchParams.set("width", String(width));
      return `${url.href} ${width}w`;
    })
    .join(", ");
}
