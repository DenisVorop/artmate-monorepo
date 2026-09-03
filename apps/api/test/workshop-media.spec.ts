import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { BadRequestException } from "@nestjs/common";
import sharp from "sharp";

import { WorkshopMediaService } from "../src/workshops/workshop-media.service";

describe("WorkshopMediaService", () => {
  const service = new WorkshopMediaService();
  const crop = { rotation: 90 as const, zoom: 1.25, x: 0.3, y: -0.4 };

  for (const format of ["jpeg", "png", "webp"] as const) {
    it(`normalizes ${format} to stripped 4:5 WebP derivatives`, async () => {
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
        crop,
      );

      assert.equal(result.sourceMime, `image/${format}`);
      assert.notDeepEqual(result.normalized.buffer, buffer);
      for (const asset of [result.normalized, result.web, result.thumb]) {
        const metadata = await sharp(asset.buffer).metadata();
        assert.equal(metadata.format, "webp");
        assert.equal(asset.width * 5, asset.height * 4);
        assert.equal(metadata.orientation, undefined);
        assert.equal(metadata.exif, undefined);
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
        crop,
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
        crop,
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
        crop,
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
      { rotation: 0, zoom: 1, x: 0, y: 0 },
    );

    assert.equal(result.sourceMime, "image/jpeg");
    assert.equal(result.normalized.width, 1600);
    assert.equal(result.normalized.height, 2000);
  });

  it("flags a perceptually identical official image without rejecting it", async () => {
    const buffer = await sharp({
      create: { width: 800, height: 1000, channels: 3, background: "#336699" },
    })
      .webp()
      .toBuffer();
    const result = await service.processPhoto(
      { buffer, size: buffer.length, originalname: "photo.webp", mimetype: "image/webp" },
      { rotation: 0, zoom: 1, x: 0, y: 0 },
      buffer,
    );

    assert.equal(result.suspectedOfficialCopy, true);
  });
});
