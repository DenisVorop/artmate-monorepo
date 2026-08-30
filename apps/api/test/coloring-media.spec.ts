import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { BadRequestException } from "@nestjs/common";
import sharp, { type WebpOptions } from "sharp";

import {
  coloringDerivativeMaxBytes,
  coloringDerivativeMaxSide,
} from "../src/colorings/coloring-derivative-profile";
import { ColoringMediaService } from "../src/colorings/coloring-media.service";
import {
  coloringLogoSourceChecksum,
  coloringWatermarkUrl,
  createColoredLogoOverlay,
  createOutlineWatermarkSvg,
} from "../src/colorings/coloring-watermarks";

describe("ColoringMediaService", () => {
  it("tiles the canonical Artmate URL diagonally across outline previews", () => {
    const watermark = createOutlineWatermarkSvg(1200, 1600);

    assert.equal(coloringWatermarkUrl, "https://artmate.ru");
    assert.match(
      watermark,
      /<pattern[^>]+patternUnits="userSpaceOnUse"[^>]+patternTransform="rotate\(-24\)"/,
    );
    assert.match(watermark, />https:\/\/artmate\.ru<\/text>/);
    assert.match(watermark, /fill="url\(#artmate-watermark\)"/);
    assert.match(watermark, /font-weight="400"/);
    assert.match(watermark, /fill-opacity="0\.18"/);
    assert.doesNotMatch(watermark, /Artmate preview/);
  });

  it("keeps the repeat spacing while using smaller text at every preview scale", () => {
    const sizes = [
      {
        width: 1200,
        height: 1600,
        fontSize: 27,
        tileWidth: 383,
        tileHeight: 145,
      },
      { width: 800, height: 600, fontSize: 17, tileWidth: 236, tileHeight: 89 },
      { width: 120, height: 100, fontSize: 10, tileWidth: 135, tileHeight: 51 },
    ];

    for (const { width, height, fontSize, tileWidth, tileHeight } of sizes) {
      const watermark = createOutlineWatermarkSvg(width, height);

      assert.match(watermark, new RegExp(`font-size="${fontSize}"`));
      assert.match(
        watermark,
        new RegExp(`<pattern[^>]+width="${tileWidth}" height="${tileHeight}"`),
      );
    }
  });

  it("renders the mobile-header Artmate logo inside the colored corner", async () => {
    const logoSource = await readFile(
      resolve(
        __dirname,
        "../../site/src/widgets/header/assets/logo-square.svg",
      ),
    );
    const overlay = await createColoredLogoOverlay(1200, 1600);
    const metadata = await sharp(overlay.input).metadata();

    assert.equal(
      createHash("sha256").update(logoSource).digest("hex"),
      coloringLogoSourceChecksum,
    );
    assert.equal(metadata.format, "png");
    assert.ok(metadata.width);
    assert.ok(metadata.height);
    assert.ok(
      Math.abs((metadata.width ?? 0) / (metadata.height ?? 1) - 41 / 36) < 0.03,
    );
    assert.ok((metadata.width ?? 0) <= 128);
    assert.equal(1200 - overlay.left - (metadata.width ?? 0), 24);
    assert.equal(1600 - overlay.top - (metadata.height ?? 0), 24);
    assert.equal(await hasTransparentAndColoredPixels(overlay.input), true);
    assert.equal(await matchesMobileHeaderLogo(overlay.input), true);
  });

  it("preserves logical watermark size at native and maximum resolution", async () => {
    for (const [width, height] of [
      [2450, 3436],
      [4096, 4096],
    ] as const) {
      const scale = Math.max(width, height) / 1600;
      const watermark = createOutlineWatermarkSvg(width, height);

      assert.ok(watermark.includes(`width="${width}" height="${height}"`));
      assert.ok(
        watermark.includes(`viewBox="0 0 ${width / scale} ${height / scale}"`),
      );
      assert.match(watermark, /font-size="27"/);
      assert.match(watermark, /width="383" height="145"/);
      assert.match(watermark, /font-weight="400"/);
      assert.match(watermark, /fill-opacity="0\.18"/);

      const overlay = await createColoredLogoOverlay(width, height);
      const metadata = await sharp(overlay.input).metadata();

      assert.equal(metadata.width, Math.round(128 * scale));
      assert.ok(metadata.height);
      assert.equal(
        width - overlay.left - metadata.width,
        Math.round(24 * scale),
      );
      assert.equal(
        height - overlay.top - metadata.height,
        Math.round(24 * scale),
      );
      assert.equal(await matchesMobileHeaderLogo(overlay.input), true);
    }
  });

  it("bakes the exact mobile-header logo into colored and card derivatives", async () => {
    const service = new ColoringMediaService();
    const width = 800;
    const height = 600;
    const cardWidth = 640;
    const cardHeight = 480;
    const coloredColor = { r: 30, g: 120, b: 210 };
    const pair = await service.processPair(
      upload(
        await createImage("png", width, height, { r: 245, g: 245, b: 245 }),
        "image/png",
      ),
      upload(
        await createImage("png", width, height, coloredColor),
        "image/png",
      ),
    );
    const [expectedColored, expectedCard] = await Promise.all([
      createExpectedLogoDerivative(width, height, coloredColor, {
        lossless: true,
      }),
      createExpectedLogoDerivative(cardWidth, cardHeight, coloredColor, {
        quality: 78,
      }),
    ]);

    assert.equal(pair.colored.buffer.equals(expectedColored), true);
    assert.equal(pair.card.buffer.equals(expectedCard), true);
  });

  it("decodes PNG and WebP, normalizes the pair and emits safe WebP derivatives", async () => {
    const service = new ColoringMediaService();
    const outline = await sharp({
      create: {
        width: 2000,
        height: 1000,
        channels: 3,
        background: { r: 245, g: 245, b: 245 },
      },
    })
      .withMetadata({ exif: { IFD0: { Copyright: "private-source" } } })
      .png()
      .toBuffer();
    const colored = await createImage("webp", 2000, 1000, {
      r: 30,
      g: 120,
      b: 210,
    });

    const pair = await service.processPair(
      upload(outline, "image/png"),
      upload(colored, "image/webp"),
    );
    const outlineMetadata = await sharp(pair.outline.buffer).metadata();
    const coloredMetadata = await sharp(pair.colored.buffer).metadata();
    const cardMetadata = await sharp(pair.card.buffer).metadata();
    const sourceMetadata = await sharp(outline).metadata();

    assert.equal(pair.width, 2000);
    assert.equal(pair.height, 1000);
    assert.equal(outlineMetadata.format, "webp");
    assert.equal(coloredMetadata.format, "webp");
    assert.equal(cardMetadata.format, "webp");
    assert.equal(outlineMetadata.width, 2000);
    assert.equal(outlineMetadata.height, 1000);
    assert.equal(coloredMetadata.width, 2000);
    assert.equal(coloredMetadata.height, 1000);
    assert.equal(outlineMetadata.space, "srgb");
    assert.equal(coloredMetadata.space, "srgb");
    assert.equal(cardMetadata.space, "srgb");
    assert.equal(outlineMetadata.pages ?? 1, 1);
    assert.equal(coloredMetadata.pages ?? 1, 1);
    assert.equal(cardMetadata.pages ?? 1, 1);
    assert.equal(cardMetadata.width, 640);
    assert.equal(cardMetadata.height, 320);
    assert.equal(pair.card.width, 640);
    assert.equal(pair.card.height, 320);
    assert.ok(pair.card.byteSize < pair.colored.byteSize);
    assert.ok(sourceMetadata.exif);
    assert.equal(outlineMetadata.exif, undefined);
    assert.equal(coloredMetadata.exif, undefined);
    assert.equal(cardMetadata.exif, undefined);
    assert.match(pair.outline.sourceChecksum, /^[0-9a-f]{64}$/);
    assert.match(pair.outline.checksum, /^[0-9a-f]{64}$/);
    assert.notEqual(pair.outline.checksum, pair.colored.checksum);
    assert.equal(await hasVisiblePixelMark(pair.outline.buffer), true);
    assert.equal(await hasVisiblePixelMark(pair.colored.buffer), true);
    assert.equal(await hasVisiblePixelMark(pair.card.buffer), true);
  });

  it("keeps native 2450x3436 details and exact pixels outside baked marks", async () => {
    const width = 2450;
    const height = 3436;
    const outlinePixels = Buffer.alloc(width * height * 3, 255);
    const coloredPixels = Buffer.alloc(width * height * 3);
    const colors = [
      [255, 183, 174],
      [255, 182, 173],
      [0, 149, 144],
    ];

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = (y * width + x) * 3;
        const color =
          colors[(Math.floor(x / 13) + Math.floor(y / 19)) % colors.length]!;

        for (let channel = 0; channel < 3; channel += 1) {
          if (x % 17 === 0 || y % 23 === 0) {
            outlinePixels[offset + channel] = 0;
          }
          coloredPixels[offset + channel] = color[channel]!;
        }
      }
    }

    const raw = { width, height, channels: 3 as const };
    const outline = await sharp(outlinePixels, { raw }).png().toBuffer();
    const colored = await sharp(coloredPixels, { raw })
      .webp({ lossless: true })
      .toBuffer();
    const pair = await new ColoringMediaService().processPair(
      upload(outline, "image/png"),
      upload(colored, "image/webp"),
    );

    assert.equal(pair.width, width);
    assert.equal(pair.height, height);
    assert.equal(pair.card.width, 456);
    assert.equal(pair.card.height, 640);

    const outlineOverlay = {
      input: Buffer.from(createOutlineWatermarkSvg(width, height)),
      left: 0,
      top: 0,
    };
    const coloredOverlay = await createColoredLogoOverlay(width, height);

    for (const [asset, sourcePixels, overlay] of [
      [pair.outline, outlinePixels, outlineOverlay],
      [pair.colored, coloredPixels, coloredOverlay],
    ] as const) {
      const expected = await sharp(sourcePixels, { raw })
        .composite([overlay])
        .toColourspace("srgb")
        .removeAlpha()
        .raw()
        .toBuffer();
      const decoded = await sharp(asset.buffer).removeAlpha().raw().toBuffer();
      const metadata = await sharp(asset.buffer).metadata();

      assert.equal(
        decoded.equals(expected),
        true,
        "lossless output must preserve every composited pixel",
      );
      assert.equal(
        decoded.equals(sourcePixels),
        false,
        "the public image must include its baked watermark",
      );
      assert.equal(asset.buffer.toString("ascii", 12, 16), "VP8L");
      assert.equal(asset.byteSize, asset.buffer.length);
      assert.ok(asset.byteSize <= coloringDerivativeMaxBytes);
      assert.equal(metadata.width, width);
      assert.equal(metadata.height, height);
      assert.equal(metadata.space, "srgb");
      assert.equal(metadata.exif, undefined);
      assert.equal(metadata.icc, undefined);

      let unchangedPixels = 0;
      for (let offset = 0; offset < decoded.length; offset += 3) {
        if (
          expected[offset] === sourcePixels[offset] &&
          expected[offset + 1] === sourcePixels[offset + 1] &&
          expected[offset + 2] === sourcePixels[offset + 2]
        ) {
          unchangedPixels += 1;
        }
      }
      assert.ok(unchangedPixels > (width * height) / 2);
    }
  });

  it("bounds larger originals at 4096 while leaving small images unenlarged", async () => {
    const service = new ColoringMediaService();

    for (const [width, height, expectedWidth, expectedHeight] of [
      [4098, 2049, 4096, 2048],
      [32, 24, 32, 24],
    ] as const) {
      const pair = await service.processPair(
        upload(
          await createImage("png", width, height, { r: 245, g: 245, b: 245 }),
          "image/png",
        ),
        upload(
          await createImage("png", width, height, { r: 30, g: 120, b: 210 }),
          "image/png",
        ),
      );

      assert.equal(pair.width, expectedWidth);
      assert.equal(pair.height, expectedHeight);
      assert.ok(pair.width <= coloringDerivativeMaxSide);
      assert.ok(pair.height <= coloringDerivativeMaxSide);
      assert.ok(pair.card.width <= 640);
      assert.ok(pair.card.height <= 640);
    }
  });

  it("rejects oversized output bytes before hashing, decoding or storage", async () => {
    const service = new ColoringMediaService();

    for (const buffer of [
      Buffer.alloc(0),
      Buffer.alloc(coloringDerivativeMaxBytes + 1),
    ]) {
      await assert.rejects(
        service.verifyDerivative(buffer, {
          checksum: "a".repeat(64),
          width: 1,
          height: 1,
        }),
        (error: unknown) =>
          error instanceof BadRequestException &&
          error.getStatus() === 400 &&
          error.message === "Coloring derivative size is invalid",
      );
    }
  });

  it("rejects a decoded derivative beyond the public geometry bound", async () => {
    const buffer = await createImage("webp", 4097, 1, {
      r: 255,
      g: 255,
      b: 255,
    });

    await assert.rejects(
      new ColoringMediaService().verifyDerivative(buffer, {
        checksum: createHash("sha256").update(buffer).digest("hex"),
        width: 4097,
        height: 1,
      }),
      BadRequestException,
    );
  });

  it("rejects files above 20 MiB before decoding", async () => {
    const service = new ColoringMediaService();
    const oversized = Buffer.alloc(20 * 1024 * 1024 + 1);
    oversized.set(Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    await assert.rejects(
      service.processPair(
        upload(oversized, "image/png"),
        upload(oversized, "image/png"),
      ),
      BadRequestException,
    );
  });

  it("rejects sources above 24 million pixels", async () => {
    const service = new ColoringMediaService();
    const outline = await createImage("png", 5000, 5000, { r: 0, g: 0, b: 0 });
    const colored = await createImage("png", 5000, 5000, {
      r: 255,
      g: 255,
      b: 255,
    });

    await assert.rejects(
      service.processPair(
        upload(outline, "image/png"),
        upload(colored, "image/png"),
      ),
      BadRequestException,
    );
  });

  it("bakes an outline watermark into a 1600x50 derivative", async () => {
    const service = new ColoringMediaService();
    const outline = await createImage("png", 1600, 50, {
      r: 245,
      g: 245,
      b: 245,
    });
    const colored = await createImage("png", 1600, 50, {
      r: 30,
      g: 120,
      b: 210,
    });

    const pair = await service.processPair(
      upload(outline, "image/png"),
      upload(colored, "image/png"),
    );

    assert.equal(await hasVisiblePixelMark(pair.outline.buffer), true);
  });

  it("bakes a colored Artmate mark into a 12x1600 derivative", async () => {
    const service = new ColoringMediaService();
    const outline = await createImage("png", 12, 1600, {
      r: 245,
      g: 245,
      b: 245,
    });
    const colored = await createImage("png", 12, 1600, {
      r: 30,
      g: 120,
      b: 210,
    });

    const pair = await service.processPair(
      upload(outline, "image/png"),
      upload(colored, "image/png"),
    );

    assert.equal(await hasVisiblePixelMark(pair.colored.buffer), true);
  });

  for (const [width, height] of [
    [1, 1],
    [1, 2],
    [1, 3],
    [1, 4],
    [1, 5],
    [2, 1],
    [3, 1],
    [4, 1],
    [5, 1],
    [1600, 1],
    [1, 1600],
  ] as const) {
    it(`bakes fallback marks into an accepted ${width}x${height} pair`, async () => {
      const service = new ColoringMediaService();
      const outlineColor = { r: 245, g: 245, b: 245 };
      const coloredColor = { r: 30, g: 120, b: 210 };
      const outline = await createImage("png", width, height, outlineColor);
      const colored = await createImage("png", width, height, coloredColor);

      const pair = await service.processPair(
        upload(outline, "image/png"),
        upload(colored, "image/png"),
      );

      assert.equal(
        await differsFromUnwatermarked(
          pair.outline.buffer,
          width,
          height,
          outlineColor,
          { lossless: true },
        ),
        true,
      );
      assert.equal(
        await differsFromUnwatermarked(
          pair.colored.buffer,
          width,
          height,
          coloredColor,
          { lossless: true },
        ),
        true,
      );
      assert.equal(
        await differsFromUnwatermarked(
          pair.card.buffer,
          pair.card.width,
          pair.card.height,
          coloredColor,
          { quality: 78 },
        ),
        true,
      );
      for (const asset of [pair.outline, pair.colored, pair.card]) {
        const metadata = await sharp(asset.buffer).metadata();

        assert.equal(metadata.format, "webp");
        assert.equal(metadata.space, "srgb");
        assert.equal(metadata.pages ?? 1, 1);
        assert.equal(metadata.width, asset.width);
        assert.equal(metadata.height, asset.height);
      }
    });
  }

  it("rejects declared MIME and magic-byte spoofing", async () => {
    const service = new ColoringMediaService();
    const png = await createImage("png", 20, 20, { r: 0, g: 0, b: 0 });
    const webp = await createImage("webp", 20, 20, {
      r: 255,
      g: 255,
      b: 255,
    });

    await assert.rejects(
      service.processPair(
        upload(png, "image/webp"),
        upload(webp, "image/webp"),
      ),
      BadRequestException,
    );
  });

  it("rejects truncated input after a full decode", async () => {
    const service = new ColoringMediaService();
    const png = await createImage("png", 20, 20, { r: 0, g: 0, b: 0 });
    const webp = await createImage("webp", 20, 20, {
      r: 255,
      g: 255,
      b: 255,
    });

    await assert.rejects(
      service.processPair(
        upload(png.subarray(0, 40), "image/png"),
        upload(webp, "image/webp"),
      ),
      BadRequestException,
    );
  });

  it("rejects source sides above 8000 pixels", async () => {
    const service = new ColoringMediaService();
    const outline = await createImage("png", 8001, 1, { r: 0, g: 0, b: 0 });
    const colored = await createImage("png", 8001, 1, {
      r: 255,
      g: 255,
      b: 255,
    });

    await assert.rejects(
      service.processPair(
        upload(outline, "image/png"),
        upload(colored, "image/png"),
      ),
      BadRequestException,
    );
  });

  it("rejects animated WebP input", async () => {
    const service = new ColoringMediaService();
    const animated = Buffer.from(
      "UklGRsAAAABXRUJQVlA4WAoAAAACAAAAAQAAAQAAQU5JTQYAAAD/////AABBTk1GSAAAAAAAAAAAAAEAAAEAAGQAAAJWUDggMAAAANABAJ0BKgIAAgACADQloAJ0ugH4AAOwAP7wxAv/ILlhdcjX/yA/5Af8gP/48gAAAEFOTUZEAAAAAAAAAAAAAQAAAQAAZAAAAFZQOCAsAAAAlAEAnQEqAgACAAAANCWgAnS6AAOYAP75k2//kB//kB//kB//ID/iF3sgMAA=",
      "base64",
    );
    const colored = await createImage("webp", 2, 2, {
      r: 255,
      g: 255,
      b: 255,
    });

    await assert.rejects(
      service.processPair(
        upload(animated, "image/webp"),
        upload(colored, "image/webp"),
      ),
      BadRequestException,
    );
  });

  it("compares auto-oriented source geometry", async () => {
    const service = new ColoringMediaService();
    const outline = await sharp({
      create: {
        width: 40,
        height: 20,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    })
      .withMetadata({ orientation: 6 })
      .png()
      .toBuffer();
    const colored = await createImage("png", 20, 40, {
      r: 255,
      g: 255,
      b: 255,
    });

    const pair = await service.processPair(
      upload(outline, "image/png"),
      upload(colored, "image/png"),
    );

    assert.equal(pair.width, 20);
    assert.equal(pair.height, 40);
  });

  it("rejects mismatched auto-oriented source geometry", async () => {
    const service = new ColoringMediaService();
    const outline = await createImage("png", 40, 20, { r: 0, g: 0, b: 0 });
    const colored = await createImage("png", 41, 20, {
      r: 255,
      g: 255,
      b: 255,
    });

    await assert.rejects(
      service.processPair(
        upload(outline, "image/png"),
        upload(colored, "image/png"),
      ),
      BadRequestException,
    );
  });

  it("rejects identical normalized pixels even across PNG and WebP", async () => {
    const service = new ColoringMediaService();
    const raw = {
      create: {
        width: 40,
        height: 20,
        channels: 3 as const,
        background: { r: 120, g: 120, b: 120 },
      },
    };
    const outline = await sharp(raw).png().toBuffer();
    const colored = await sharp(raw).webp({ lossless: true }).toBuffer();

    await assert.rejects(
      service.processPair(
        upload(outline, "image/png"),
        upload(colored, "image/webp"),
      ),
      BadRequestException,
    );
  });

  it("verifies stored derivatives by checksum, decode and geometry", async () => {
    const service = new ColoringMediaService();
    const outline = await createImage("png", 40, 20, { r: 0, g: 0, b: 0 });
    const colored = await createImage("png", 40, 20, {
      r: 255,
      g: 255,
      b: 255,
    });
    const pair = await service.processPair(
      upload(outline, "image/png"),
      upload(colored, "image/png"),
    );

    await service.verifyDerivative(pair.outline.buffer, {
      checksum: pair.outline.checksum,
      width: pair.width,
      height: pair.height,
    });
    await assert.rejects(
      service.verifyDerivative(pair.outline.buffer, {
        checksum: "0".repeat(64),
        width: pair.width,
        height: pair.height,
      }),
      BadRequestException,
    );
  });
});

function upload(buffer: Buffer, mimetype: string) {
  return {
    buffer,
    mimetype,
    originalname: "untrusted.bin",
    size: buffer.length,
  };
}

function createImage(
  format: "png" | "webp",
  width: number,
  height: number,
  background: { r: number; g: number; b: number },
) {
  const image = sharp({
    create: {
      width,
      height,
      channels: 3,
      background,
    },
  });

  return format === "png" ? image.png().toBuffer() : image.webp().toBuffer();
}

async function hasVisiblePixelMark(buffer: Buffer) {
  const { data, info } = await sharp(buffer).raw().toBuffer({
    resolveWithObject: true,
  });

  for (let channel = 0; channel < info.channels; channel += 1) {
    let min = 255;
    let max = 0;

    for (let offset = channel; offset < data.length; offset += info.channels) {
      min = Math.min(min, data[offset] ?? 255);
      max = Math.max(max, data[offset] ?? 0);
    }

    if (max - min < 8) {
      return false;
    }
  }

  return true;
}

async function createExpectedLogoDerivative(
  width: number,
  height: number,
  background: { r: number; g: number; b: number },
  options: WebpOptions,
) {
  const overlay = await createColoredLogoOverlay(width, height);

  return sharp({
    create: { width, height, channels: 3, background },
  })
    .composite([overlay])
    .toColourspace("srgb")
    .webp({ effort: 4, ...options })
    .toBuffer();
}

async function differsFromUnwatermarked(
  buffer: Buffer,
  width: number,
  height: number,
  background: { r: number; g: number; b: number },
  options: WebpOptions,
) {
  const baseline = await sharp({
    create: { width, height, channels: 3, background },
  })
    .webp({ effort: 4, ...options })
    .toBuffer();
  const [actualPixels, baselinePixels] = await Promise.all([
    sharp(buffer).raw().toBuffer(),
    sharp(baseline).raw().toBuffer(),
  ]);

  return !actualPixels.equals(baselinePixels);
}

async function hasTransparentAndColoredPixels(buffer: Buffer) {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let hasTransparentPixel = false;
  let hasColoredPixel = false;

  for (let offset = 0; offset < data.length; offset += info.channels) {
    const red = data[offset] ?? 0;
    const green = data[offset + 1] ?? 0;
    const blue = data[offset + 2] ?? 0;
    const alpha = data[offset + 3] ?? 255;

    hasTransparentPixel ||= alpha < 32;
    hasColoredPixel ||=
      alpha > 96 &&
      Math.max(red, green, blue) - Math.min(red, green, blue) > 24;

    if (hasTransparentPixel && hasColoredPixel) {
      return true;
    }
  }

  return false;
}

async function matchesMobileHeaderLogo(buffer: Buffer) {
  const actualMetadata = await sharp(buffer).metadata();

  if (!actualMetadata.width || !actualMetadata.height) {
    return false;
  }

  const source = await readFile(
    resolve(__dirname, "../../site/src/widgets/header/assets/logo-square.svg"),
  );
  const [actual, expected] = await Promise.all([
    sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(source, { density: 300 })
      .resize({ width: actualMetadata.width })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true }),
  ]);

  if (
    actual.info.width !== expected.info.width ||
    actual.info.height !== expected.info.height ||
    actual.info.channels !== expected.info.channels
  ) {
    return false;
  }

  for (let offset = 0; offset < actual.data.length; offset += 4) {
    if (
      actual.data[offset] !== expected.data[offset] ||
      actual.data[offset + 1] !== expected.data[offset + 1] ||
      actual.data[offset + 2] !== expected.data[offset + 2]
    ) {
      return false;
    }
  }

  return true;
}
