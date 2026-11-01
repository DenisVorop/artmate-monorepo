import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { it } from "node:test";
import { NotFoundException } from "@nestjs/common";
import sharp from "sharp";
import { WorkshopMediaService } from "../src/workshops/workshop-media.service";
import { WorkshopStorageService } from "../src/workshops/workshop-storage.service";

it("resizes verified photos to WebP without enlargement, reuses transforms and never bypasses file checks", async () => {
  const root = await mkdtemp(join(tmpdir(), "artmate-responsive-"));
  const media = new WorkshopMediaService();
  let resizeCalls = 0;
  const resize = media.resize.bind(media);
  media.resize = async (...args) => {
    resizeCalls++;
    return resize(...args);
  };
  const storage = new WorkshopStorageService(media, root);
  try {
    const buffer = await sharp({
      create: { width: 1200, height: 1500, channels: 3, background: "#abcd12" },
    })
      .webp()
      .toBuffer();
    const checksum = createHash("sha256").update(buffer).digest("hex");
    const key = `${"a".repeat(32)}/${"b".repeat(32)}/web-${checksum}.webp`;
    const expected = { checksum, width: 1200, height: 1500 };
    await storage.writeAssets([{ key, buffer, checksum }]);
    const small = await storage.read(key, expected, 480);
    const metadata = await sharp(small).metadata();
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.width, 480);
    assert.equal(metadata.height, 600);
    assert.equal(metadata.exif, undefined);
    assert.deepEqual(await storage.read(key, expected, 480), small);
    assert.equal(resizeCalls, 1);
    assert.deepEqual(await storage.read(key, expected, 1200), buffer);
    assert.deepEqual(await storage.read(key, expected, 1920), buffer);
    await assert.rejects(
      storage.read(key, { ...expected, checksum: "c".repeat(64) }, 480),
      NotFoundException,
    );
    await storage.deleteAsset(key);
    await assert.rejects(storage.read(key, expected, 480), NotFoundException);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
