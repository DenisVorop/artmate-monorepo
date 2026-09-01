import { createHash } from "node:crypto";

import { BadRequestException, Injectable } from "@nestjs/common";
import sharp, { type Metadata } from "sharp";

export type WorkshopUploadedFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

export type WorkshopCrop = {
  rotation: 0 | 90 | 180 | 270;
  zoom: number;
  x: number;
  y: number;
};

export type WorkshopAsset = {
  buffer: Buffer;
  checksum: string;
  byteSize: number;
  width: number;
  height: number;
};

export type ProcessedWorkshopPhoto = {
  sourceMime: "image/jpeg" | "image/png" | "image/webp";
  sourceChecksum: string;
  perceptualHash: string;
  suspectedOfficialCopy: boolean;
  normalized: WorkshopAsset;
  web: WorkshopAsset;
  thumb: WorkshopAsset;
};

const maxInputBytes = 10 * 1024 * 1024;
const maxInputPixels = 24_000_000;
const maxInputSide = 8_000;
const processingTimeoutSeconds = 20;

@Injectable()
export class WorkshopMediaService {
  async processPhoto(
    file: WorkshopUploadedFile,
    crop: WorkshopCrop,
    officialColored?: Buffer,
  ): Promise<ProcessedWorkshopPhoto> {
    try {
      this.validateFileSize(file);
      const sourceMime = this.detectMime(file.buffer);

      if (!sourceMime || sourceMime !== file.mimetype) {
        throw new BadRequestException("Workshop photo type is invalid");
      }

      const image = this.open(file.buffer);
      const metadata = await image.metadata();
      this.validateMetadata(metadata, sourceMime);

      const orientedWidth = metadata.autoOrient.width;
      const orientedHeight = metadata.autoOrient.height;

      if (
        orientedWidth > maxInputSide ||
        orientedHeight > maxInputSide ||
        orientedWidth * orientedHeight > maxInputPixels
      ) {
        throw new BadRequestException("Workshop photo dimensions are too large");
      }

      // Force a complete single-page decode before deriving any stored bytes.
      await image.clone().raw().toBuffer();
      const oriented = await image
        .clone()
        .autoOrient()
        .flatten({ background: "#ffffff" })
        .toColourspace("srgb")
        .removeAlpha()
        .rotate(crop.rotation)
        .raw()
        .toBuffer({ resolveWithObject: true });
      const cropped = await this.crop(oriented.data, oriented.info, crop);
      const normalized = await this.encode(cropped, 1600, 92);
      const web = await this.encode(cropped, 1200, 84);
      const thumb = await this.encode(cropped, 320, 78);
      const perceptualHash = await this.perceptualHash(web.buffer);
      const officialHash = officialColored
        ? await this.perceptualHash(officialColored).catch(() => undefined)
        : undefined;

      return {
        sourceMime,
        sourceChecksum: this.sha256(file.buffer),
        perceptualHash,
        suspectedOfficialCopy: officialHash
          ? this.hammingDistance(perceptualHash, officialHash) <= 6
          : false,
        normalized,
        web,
        thumb,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException("Workshop photo is invalid");
    }
  }

  async verifyDerivative(
    buffer: Buffer,
    expected: { checksum: string; width: number; height: number },
  ) {
    try {
      if (
        buffer.length <= 0 ||
        buffer.length > maxInputBytes ||
        this.sha256(buffer) !== expected.checksum
      ) {
        throw new BadRequestException("Workshop asset checksum is invalid");
      }

      const image = this.open(buffer);
      const metadata = await image.metadata();

      if (
        metadata.format !== "webp" ||
        (metadata.pages ?? 1) !== 1 ||
        metadata.width !== expected.width ||
        metadata.height !== expected.height ||
        metadata.width * 5 !== metadata.height * 4 ||
        metadata.space !== "srgb"
      ) {
        throw new BadRequestException("Workshop asset is invalid");
      }

      await image.raw().toBuffer();
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException("Workshop asset is invalid");
    }
  }

  private open(buffer: Buffer) {
    return sharp(buffer, {
      animated: true,
      failOn: "warning",
      limitInputPixels: maxInputPixels,
      sequentialRead: true,
    }).timeout({ seconds: processingTimeoutSeconds });
  }

  private validateFileSize(file: WorkshopUploadedFile) {
    if (
      file.size <= 0 ||
      file.size > maxInputBytes ||
      file.buffer.length !== file.size
    ) {
      throw new BadRequestException("Workshop photo size is invalid");
    }
  }

  private validateMetadata(
    metadata: Metadata,
    sourceMime: "image/jpeg" | "image/png" | "image/webp",
  ) {
    const expectedFormat = sourceMime.slice("image/".length);

    if (
      metadata.format !== expectedFormat ||
      (metadata.pages ?? 1) !== 1 ||
      !metadata.width ||
      !metadata.height ||
      !metadata.autoOrient.width ||
      !metadata.autoOrient.height
    ) {
      throw new BadRequestException("Workshop photo metadata is invalid");
    }
  }

  private async crop(
    pixels: Buffer,
    info: { width: number; height: number; channels: number },
    crop: WorkshopCrop,
  ) {
    if (info.channels !== 3) {
      throw new BadRequestException("Workshop photo channels are invalid");
    }

    const baseWidth = Math.floor(Math.min(info.width, info.height * 0.8) / 4) * 4;
    const cropWidth = Math.floor(baseWidth / crop.zoom / 4) * 4;
    const cropHeight = (cropWidth * 5) / 4;

    if (cropWidth < 4 || cropHeight > info.height) {
      throw new BadRequestException("Workshop crop is invalid");
    }

    const availableX = info.width - cropWidth;
    const availableY = info.height - cropHeight;
    const left = Math.round(((crop.x + 1) / 2) * availableX);
    const top = Math.round(((crop.y + 1) / 2) * availableY);
    const result = await sharp(pixels, {
      raw: { width: info.width, height: info.height, channels: 3 },
    })
      .extract({ left, top, width: cropWidth, height: cropHeight })
      .raw()
      .toBuffer({ resolveWithObject: true });

    return {
      pixels: result.data,
      width: result.info.width,
      height: result.info.height,
    };
  }

  private async encode(
    input: { pixels: Buffer; width: number; height: number },
    maxWidth: number,
    quality: number,
  ): Promise<WorkshopAsset> {
    const width = Math.max(4, Math.floor(Math.min(input.width, maxWidth) / 4) * 4);
    const height = (width * 5) / 4;
    const buffer = await sharp(input.pixels, {
      raw: { width: input.width, height: input.height, channels: 3 },
    })
      .resize(width, height, { fit: "fill" })
      .toColourspace("srgb")
      .webp({ effort: 4, quality })
      .timeout({ seconds: processingTimeoutSeconds })
      .toBuffer();
    const checksum = this.sha256(buffer);

    await this.verifyDerivative(buffer, { checksum, width, height });

    return { buffer, checksum, byteSize: buffer.length, width, height };
  }

  private async perceptualHash(buffer: Buffer) {
    const { data } = await this.open(buffer)
      .resize(9, 8, { fit: "fill" })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let bits = 0n;

    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        bits =
          (bits << 1n) |
          BigInt((data[y * 9 + x] ?? 0) > (data[y * 9 + x + 1] ?? 0) ? 1 : 0);
      }
    }

    return bits.toString(16).padStart(16, "0");
  }

  private hammingDistance(left: string, right: string) {
    let xor = BigInt(`0x${left}`) ^ BigInt(`0x${right}`);
    let distance = 0;

    while (xor) {
      distance += Number(xor & 1n);
      xor >>= 1n;
    }

    return distance;
  }

  private detectMime(buffer: Buffer) {
    if (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    ) {
      return "image/jpeg" as const;
    }

    if (
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      )
    ) {
      return "image/png" as const;
    }

    if (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    ) {
      return "image/webp" as const;
    }

    return undefined;
  }

  private sha256(buffer: Buffer) {
    return createHash("sha256").update(buffer).digest("hex");
  }
}
