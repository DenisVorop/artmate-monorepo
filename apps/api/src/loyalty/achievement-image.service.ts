import { BadRequestException, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

export const maxAchievementImageBytes = 5 * 1024 * 1024;
const maxImagePixels = 24_000_000;

export type UploadedAchievementImage = {
  buffer: Buffer;
  mimetype: string;
  size: number;
};

@Injectable()
export class LoyaltyAchievementImageService {
  async upload(file: UploadedAchievementImage | undefined) {
    if (!file) {
      throw new BadRequestException("Achievement image file is required");
    }
    if (
      !Buffer.isBuffer(file.buffer) ||
      file.size <= 0 ||
      file.size > maxAchievementImageBytes ||
      file.size !== file.buffer.length
    ) {
      throw new BadRequestException("Achievement image size is invalid");
    }
    const format = declaredFormat(file);
    if (!format) {
      throw new BadRequestException(
        "Achievement image must be JPEG, PNG or WebP",
      );
    }

    let output: Buffer;
    try {
      const image = sharp(file.buffer, {
        animated: true,
        failOn: "warning",
        limitInputPixels: maxImagePixels,
        sequentialRead: true,
      }).timeout({ seconds: 15 });
      const metadata = await image.metadata();
      if (
        metadata.format !== format ||
        (metadata.pages ?? 1) !== 1 ||
        !metadata.width ||
        !metadata.height ||
        metadata.width * metadata.height > maxImagePixels
      ) {
        throw new BadRequestException(
          "Achievement image dimensions or format are invalid",
        );
      }
      // Sharp strips metadata by default. Preserve transparency for badge artwork.
      output = await image
        .autoOrient()
        .toColourspace("srgb")
        .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 85, effort: 4 })
        .toBuffer();
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException("Achievement image is invalid");
    }

    const filename = `${randomUUID()}.webp`;
    const directory = join(this.getUploadsRoot(), "loyalty-achievements");
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, filename), output, { flag: "wx" });
    return {
      url: `${this.getApiPublicUrl()}/uploads/loyalty-achievements/${filename}`,
    };
  }

  protected getUploadsRoot() {
    return join(process.cwd(), "uploads");
  }

  protected getApiPublicUrl() {
    return (
      process.env.API_PUBLIC_URL ??
      process.env.API_BASE_URL ??
      `http://localhost:${process.env.PORT ?? "3002"}`
    ).replace(/\/+$/, "");
  }
}

function declaredFormat(file: UploadedAchievementImage) {
  const buffer = file.buffer;
  if (
    file.mimetype === "image/jpeg" &&
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  )
    return "jpeg";
  if (
    file.mimetype === "image/png" &&
    buffer.length >= 8 &&
    buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return "png";
  if (
    file.mimetype === "image/webp" &&
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  )
    return "webp";
  return null;
}
