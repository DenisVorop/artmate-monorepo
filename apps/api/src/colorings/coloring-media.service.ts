import { createHash, timingSafeEqual } from "node:crypto";

import { BadRequestException, Injectable } from "@nestjs/common";
import sharp, { type Metadata } from "sharp";

import {
  coloringDerivativeMaxBytes,
  coloringDerivativeMaxSide,
} from "./coloring-derivative-profile";
import {
  createColoredLogoOverlay,
  createOutlineWatermarkSvg,
} from "./coloring-watermarks";

export type UploadedColoringFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

export type ProcessedColoringAsset = {
  buffer: Buffer;
  sourceMime: "image/png" | "image/webp";
  sourceChecksum: string;
  checksum: string;
  byteSize: number;
  width: number;
  height: number;
};

export type ProcessedColoringPair = {
  width: number;
  height: number;
  outline: ProcessedColoringAsset;
  colored: ProcessedColoringAsset;
  card: ProcessedColoringAsset;
};

const maxInputBytes = 20 * 1024 * 1024;
const maxInputPixels = 24_000_000;
const maxInputSide = 8_000;
const maxCardSide = 640;
const processingTimeoutSeconds = 20;

type AcceptedMime = ProcessedColoringAsset["sourceMime"];

type NormalizedImage = {
  sourceMime: AcceptedMime;
  sourceChecksum: string;
  sourceWidth: number;
  sourceHeight: number;
  width: number;
  height: number;
  pixels: Buffer;
};

@Injectable()
export class ColoringMediaService {
  async processPair(
    outline: UploadedColoringFile,
    colored: UploadedColoringFile,
  ): Promise<ProcessedColoringPair> {
    try {
      const normalizedOutline = await this.normalizeInput(outline);
      const normalizedColored = await this.normalizeInput(colored);

      if (
        normalizedOutline.sourceWidth !== normalizedColored.sourceWidth ||
        normalizedOutline.sourceHeight !== normalizedColored.sourceHeight ||
        normalizedOutline.width !== normalizedColored.width ||
        normalizedOutline.height !== normalizedColored.height
      ) {
        throw new BadRequestException(
          "Coloring image pair must have matching geometry",
        );
      }

      if (
        normalizedOutline.pixels.length === normalizedColored.pixels.length &&
        timingSafeEqual(normalizedOutline.pixels, normalizedColored.pixels)
      ) {
        throw new BadRequestException(
          "Outline and colored images must be different",
        );
      }

      const outlineAsset = await this.encodeDerivative(
        normalizedOutline,
        "outline",
      );
      const coloredAsset = await this.encodeDerivative(
        normalizedColored,
        "colored",
      );
      const cardAsset = await this.encodeDerivative(normalizedColored, "card");

      if (outlineAsset.checksum === coloredAsset.checksum) {
        throw new BadRequestException(
          "Outline and colored derivatives must be different",
        );
      }

      return {
        width: normalizedOutline.width,
        height: normalizedOutline.height,
        outline: outlineAsset,
        colored: coloredAsset,
        card: cardAsset,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException("Coloring image pair is invalid");
    }
  }

  async verifyDerivative(
    buffer: Buffer,
    expected: { checksum: string; width: number; height: number },
  ): Promise<void> {
    try {
      if (buffer.length === 0 || buffer.length > coloringDerivativeMaxBytes) {
        throw new BadRequestException("Coloring derivative size is invalid");
      }

      if (this.sha256(buffer) !== expected.checksum) {
        throw new BadRequestException("Coloring derivative checksum mismatch");
      }

      const image = sharp(buffer, {
        animated: true,
        failOn: "warning",
        limitInputPixels: maxInputPixels,
        sequentialRead: true,
      }).timeout({ seconds: processingTimeoutSeconds });
      const metadata = await image.metadata();

      if (
        metadata.format !== "webp" ||
        (metadata.pages ?? 1) !== 1 ||
        metadata.width !== expected.width ||
        metadata.height !== expected.height ||
        metadata.width > coloringDerivativeMaxSide ||
        metadata.height > coloringDerivativeMaxSide ||
        metadata.space !== "srgb"
      ) {
        throw new BadRequestException("Coloring derivative is invalid");
      }

      await image.clone().raw().toBuffer();
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException("Coloring derivative is invalid");
    }
  }

  private async normalizeInput(
    file: UploadedColoringFile,
  ): Promise<NormalizedImage> {
    if (
      file.size <= 0 ||
      file.size > maxInputBytes ||
      file.buffer.length !== file.size
    ) {
      throw new BadRequestException("Coloring image size is invalid");
    }

    const sourceMime = this.detectMime(file.buffer);

    if (!sourceMime || sourceMime !== file.mimetype) {
      throw new BadRequestException("Coloring image type is invalid");
    }

    const image = sharp(file.buffer, {
      animated: true,
      failOn: "warning",
      limitInputPixels: maxInputPixels,
      sequentialRead: true,
    }).timeout({ seconds: processingTimeoutSeconds });
    const metadata = await image.metadata();

    this.validateMetadata(metadata, sourceMime);

    const orientedWidth = metadata.autoOrient.width;
    const orientedHeight = metadata.autoOrient.height;

    if (
      orientedWidth > maxInputSide ||
      orientedHeight > maxInputSide ||
      orientedWidth * orientedHeight > maxInputPixels
    ) {
      throw new BadRequestException("Coloring image dimensions are too large");
    }

    const normalized = await image
      .clone()
      .autoOrient()
      .flatten({ background: "#ffffff" })
      .toColourspace("srgb")
      .resize(coloringDerivativeMaxSide, coloringDerivativeMaxSide, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    if (normalized.info.channels !== 3) {
      throw new BadRequestException("Coloring image channels are invalid");
    }

    return {
      sourceMime,
      sourceChecksum: this.sha256(file.buffer),
      sourceWidth: orientedWidth,
      sourceHeight: orientedHeight,
      width: normalized.info.width,
      height: normalized.info.height,
      pixels: normalized.data,
    };
  }

  private validateMetadata(metadata: Metadata, sourceMime: AcceptedMime) {
    const expectedFormat = sourceMime === "image/png" ? "png" : "webp";

    if (
      metadata.format !== expectedFormat ||
      (metadata.pages ?? 1) !== 1 ||
      !metadata.width ||
      !metadata.height ||
      !metadata.autoOrient.width ||
      !metadata.autoOrient.height
    ) {
      throw new BadRequestException("Coloring image metadata is invalid");
    }
  }

  private async encodeDerivative(
    image: NormalizedImage,
    kind: "outline" | "colored" | "card",
  ): Promise<ProcessedColoringAsset> {
    const derivative =
      kind === "card"
        ? await sharp(image.pixels, {
            raw: {
              width: image.width,
              height: image.height,
              channels: 3,
            },
          })
            .resize(maxCardSide, maxCardSide, {
              fit: "inside",
              withoutEnlargement: true,
            })
            .raw()
            .toBuffer({ resolveWithObject: true })
        : {
            data: image.pixels,
            info: {
              width: image.width,
              height: image.height,
              channels: 3,
            },
          };
    const width = derivative.info.width;
    const height = derivative.info.height;
    const overlay =
      kind === "outline"
        ? {
            input: Buffer.from(createOutlineWatermarkSvg(width, height)),
            left: 0,
            top: 0,
          }
        : await createColoredLogoOverlay(width, height);
    const buffer = await sharp(derivative.data, {
      raw: {
        width,
        height,
        channels: 3,
      },
    })
      .composite([overlay])
      .toColourspace("srgb")
      .webp(
        kind === "card"
          ? { effort: 4, quality: 78 }
          : { effort: 4, lossless: true },
      )
      .timeout({ seconds: processingTimeoutSeconds })
      .toBuffer();
    const checksum = this.sha256(buffer);

    await this.verifyDerivative(buffer, {
      checksum,
      width,
      height,
    });

    return {
      buffer,
      sourceMime: image.sourceMime,
      sourceChecksum: image.sourceChecksum,
      checksum,
      byteSize: buffer.length,
      width,
      height,
    };
  }

  private detectMime(buffer: Buffer): AcceptedMime | undefined {
    if (
      buffer.length >= 8 &&
      buffer
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    ) {
      return "image/png";
    }

    if (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    ) {
      return "image/webp";
    }

    return undefined;
  }

  private sha256(buffer: Buffer) {
    return createHash("sha256").update(buffer).digest("hex");
  }
}
