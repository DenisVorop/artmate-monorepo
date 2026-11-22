import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { BadRequestException } from "@nestjs/common";
import sharp from "sharp";

import { UserPhotoMediaService } from "../src/user-photos/user-photo-media.service";

describe("UserPhotoMediaService", () => {
  const service = new UserPhotoMediaService();

  for (const format of ["jpeg", "png", "webp"] as const) {
    it(`normalizes ${format} to stripped WebP derivatives preserving the full frame`, async () => {
      let image = sharp({
        create: { width: 900, height: 700, channels: 3, background: "#d56a4d" },
      });
      if (format === "jpeg") {
        image = image.withMetadata({ orientation: 6 });
      }
      const buffer = await image[format]().toBuffer();
      const result = await service.processPhoto(
        {
          buffer,
          size: buffer.length,
          originalname: `photo.${format}`,
          mimetype: `image/${format}`,
        },
      );

      assert.equal(result.sourceMime, `image/${format}`);
      assert.notDeepEqual(result.normalized.buffer, buffer);
      for (const asset of [result.normalized, result.web, result.thumb]) {
        const metadata = await sharp(asset.buffer).metadata();
        assert.equal(metadata.format, "webp");
        const sourceWidth = format === "jpeg" ? 700 : 900;
        const sourceHeight = format === "jpeg" ? 900 : 700;
        assert.ok(Math.abs(asset.width / asset.height - sourceWidth / sourceHeight) < 0.005);
        assert.equal(metadata.width, asset.width);
        assert.equal(metadata.height, asset.height);
        assert.equal(metadata.orientation, undefined);
        assert.equal(metadata.exif, undefined);
      }
    });
  }

  it("preserves decorations at both edges when resizing a landscape photo", async () => {
    const band = await sharp({
      create: { width: 300, height: 900, channels: 3, background: "#ff0000" },
    })
      .png()
      .toBuffer();
    const buffer = await sharp({
      create: { width: 1800, height: 900, channels: 3, background: "#ffffff" },
    })
      .composite([
        { input: band, left: 0, top: 0 },
        { input: band, left: 1500, top: 0 },
      ])
      .png()
      .toBuffer();
    const result = await service.processPhoto({
      buffer,
      size: buffer.length,
      originalname: "composition.png",
      mimetype: "image/png",
    });

    for (const asset of [result.normalized, result.web, result.thumb]) {
      assert.equal(asset.width, asset.height * 2);
      const { data, info } = await sharp(asset.buffer)
        .raw()
        .toBuffer({ resolveWithObject: true });
      for (const x of [
        Math.floor(info.width * 0.05),
        Math.floor(info.width * 0.95),
      ]) {
        const offset =
          (Math.floor(info.height / 2) * info.width + x) * info.channels;
        assert.ok(data[offset]! > 200, "red decoration must remain visible");
        assert.ok(
          data[offset + 1]! < 60,
          "edge must not be replaced by the white centre",
        );
      }
    }
  });

  for (const [width, height] of [
    [501, 1301],
    [1301, 501],
    [777, 777],
    [40, 20],
  ] as const) {
    it(`keeps proportions and avoids enlarging a ${width}x${height} photo`, async () => {
      const buffer = await sharp({
        create: { width, height, channels: 3, background: "white" },
      })
        .png()
        .toBuffer();
      const result = await service.processPhoto({
        buffer,
        size: buffer.length,
        originalname: "photo.png",
        mimetype: "image/png",
      });
      for (const [asset, maxSide] of [
        [result.normalized, 1600],
        [result.web, 1200],
        [result.thumb, 320],
      ] as const) {
        assert.ok(asset.width <= Math.min(width, maxSide));
        assert.ok(asset.height <= Math.min(height, maxSide));
        assert.ok(Math.abs(asset.width / asset.height - width / height) < 0.02);
      }
    });
  }

  it("rejects declared MIME spoofing", async () => {
    const buffer = await sharp({
      create: { width: 20, height: 20, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();

    await assert.rejects(
      service.processPhoto(
        { buffer, size: buffer.length, originalname: "x.jpg", mimetype: "image/jpeg" },
      ),
      BadRequestException,
    );
  });

  it("rejects byte and pixel/side limits", async () => {
    await assert.rejects(
      service.processPhoto(
        {
          buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
          size: 10 * 1024 * 1024 + 1,
          originalname: "large.jpg",
          mimetype: "image/jpeg",
        },
      ),
      BadRequestException,
    );

    const wide = await sharp({
      create: { width: 8001, height: 10, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();
    await assert.rejects(
      service.processPhoto(
        { buffer: wide, size: wide.length, originalname: "wide.png", mimetype: "image/png" },
      ),
      BadRequestException,
    );
  });

  it("accepts modern phone photos slightly above 24 megapixels", async () => {
    const buffer = await sharp({
      create: { width: 5712, height: 4284, channels: 3, background: "#5a79c8" },
    })
      .jpeg()
      .toBuffer();
    const result = await service.processPhoto(
      { buffer, size: buffer.length, originalname: "iphone.jpg", mimetype: "image/jpeg" },
    );

    assert.equal(result.sourceMime, "image/jpeg");
    assert.equal(result.normalized.width, 1600);
    assert.equal(result.normalized.height, 1200);
  });

  it("flags a perceptually identical official image without rejecting it", async () => {
    const buffer = await sharp({
      create: { width: 800, height: 1000, channels: 3, background: "#336699" },
    })
      .webp()
      .toBuffer();
    const result = await service.processPhoto(
      { buffer, size: buffer.length, originalname: "photo.webp", mimetype: "image/webp" },
      buffer,
    );

    assert.equal(result.suspectedOfficialCopy, true);
  });
});
