import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import sharp from "sharp";

export const coloringWatermarkUrl = "https://artmate.ru";
export const coloringLogoSourceChecksum =
  "0f88788505d15ed78e01b4492717f887fa91e4cc6e20693ae195f48933dd443f";

export type ColoringWatermarkOverlay = {
  input: Buffer;
  left: number;
  top: number;
};

const logoAspectRatio = 41 / 36;
const logoOpacity = 0.88;
const watermarkReferenceMaxSide = 1600;
const renderedLogos = new Map<number, Promise<Buffer>>();
let logoSource: Promise<Buffer> | undefined;

export function createOutlineWatermarkSvg(width: number, height: number) {
  const scale = getWatermarkScale(width, height);
  const logicalWidth = width / scale;
  const logicalHeight = height / scale;

  if (logicalWidth < 48 || logicalHeight < 12) {
    return createCompactFallback(width, height);
  }

  const shortestSide = Math.min(logicalWidth, logicalHeight);
  const patternScale = clamp(Math.round(shortestSide * 0.035), 12, 34);
  const fontSize = Math.round(patternScale * 0.8);
  const tileWidth = Math.round(patternScale * 11.25);
  const tileHeight = Math.round(patternScale * 4.25);
  const overscan = Math.ceil(Math.hypot(logicalWidth, logicalHeight));

  return [
    `<svg width="${width}" height="${height}" viewBox="0 0 ${logicalWidth} ${logicalHeight}" xmlns="http://www.w3.org/2000/svg">`,
    "<defs>",
    `<pattern id="artmate-watermark" width="${tileWidth}" height="${tileHeight}" patternUnits="userSpaceOnUse" patternTransform="rotate(-24)">`,
    `<text x="${Math.round(patternScale * 0.5)}" y="${Math.round(patternScale * 1.45)}" fill="#6d284d" fill-opacity="0.18" font-family="DejaVu Sans, sans-serif" font-size="${fontSize}" font-weight="400" letter-spacing="0.3">${coloringWatermarkUrl}</text>`,
    "</pattern>",
    "</defs>",
    `<rect x="-${overscan}" y="-${overscan}" width="${logicalWidth + overscan * 2}" height="${logicalHeight + overscan * 2}" fill="url(#artmate-watermark)" />`,
    "</svg>",
  ].join("");
}

export async function createColoredLogoOverlay(
  width: number,
  height: number,
): Promise<ColoringWatermarkOverlay> {
  const scale = getWatermarkScale(width, height);
  const shortestSide = Math.min(width, height) / scale;

  if (shortestSide < 4) {
    return {
      input: Buffer.from(createCompactFallback(width, height)),
      left: 0,
      top: 0,
    };
  }

  const margin = Math.round(
    clamp(Math.round(shortestSide * 0.025), 1, 24) * scale,
  );
  const availableWidth = Math.max(1, width - margin * 2);
  const availableHeight = Math.max(1, height - margin * 2);
  const preferredWidth = Math.round(
    clamp(Math.round(shortestSide * 0.14), 48, 128) * scale,
  );
  const logoWidth = Math.max(
    1,
    Math.min(
      preferredWidth,
      availableWidth,
      Math.floor(availableHeight * logoAspectRatio),
    ),
  );
  const input = await renderLogo(logoWidth);
  const metadata = await sharp(input).metadata();
  const renderedWidth = metadata.width ?? logoWidth;
  const renderedHeight =
    metadata.height ?? Math.ceil(logoWidth / logoAspectRatio);

  return {
    input,
    left: Math.max(0, width - margin - renderedWidth),
    top: Math.max(0, height - margin - renderedHeight),
  };
}

function createCompactFallback(width: number, height: number) {
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg"><rect width="${width}" height="${height}" fill="#6d284d" fill-opacity="0.18" /></svg>`;
}

function renderLogo(width: number) {
  const cached = renderedLogos.get(width);

  if (cached) {
    return cached;
  }

  const rendered = renderLogoAtWidth(width);

  renderedLogos.set(width, rendered);

  return rendered;
}

async function renderLogoAtWidth(width: number) {
  const source = await loadLogoSource();
  const { data, info } = await sharp(source, { density: 300 })
    .resize({ width })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let offset = 3; offset < data.length; offset += info.channels) {
    data[offset] = Math.round((data[offset] ?? 0) * logoOpacity);
  }

  return sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .png()
    .toBuffer();
}

function loadLogoSource() {
  logoSource ??= readLogoSource();

  return logoSource;
}

async function readLogoSource() {
  const candidates = [
    resolve(process.cwd(), "assets", "artmate-logo-square.svg"),
    resolve(
      __dirname,
      "../../../site/src/widgets/header/assets/logo-square.svg",
    ),
  ];

  for (const candidate of candidates) {
    try {
      const source = await readFile(candidate);

      if (
        createHash("sha256").update(source).digest("hex") !==
        coloringLogoSourceChecksum
      ) {
        throw new Error("Artmate square logo asset has changed");
      }

      return source;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  throw new Error("Artmate square logo asset is missing");
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function getWatermarkScale(width: number, height: number) {
  return Math.max(1, Math.max(width, height) / watermarkReferenceMaxSide);
}
