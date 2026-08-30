import { createHash } from "node:crypto";
import { join } from "node:path";

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import sharp from "sharp";

import { ColoringCollectionStatus } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";

import { writeImmutableFile } from "./immutable-file-storage";

export type UploadedColoringCollectionCover = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

const maxCoverBytes = 10 * 1024 * 1024;
const maxCoverPixels = 24_000_000;
const maxCoverSide = 8_000;
const maxOutputSide = 1_200;
const processingTimeoutSeconds = 20;

@Injectable()
export class ColoringCollectionCoverService {
  constructor(private readonly prisma: PrismaService) {}

  async uploadCover(
    collectionId: string,
    file: UploadedColoringCollectionCover | undefined,
    alt: string | undefined,
    updatedAt: string,
  ) {
    if (!file) {
      throw new BadRequestException("Coloring collection cover is required");
    }

    const parsedAlt = this.parseAlt(alt);
    const expectedUpdatedAt = new Date(updatedAt);
    const current = await this.prisma.coloringCollection.findUnique({
      where: { id: collectionId },
      select: { id: true, status: true, updatedAt: true },
    });

    if (!current) {
      throw new NotFoundException("Coloring collection not found");
    }

    if (current.status !== ColoringCollectionStatus.DRAFT) {
      throw new ConflictException(
        "Published or archived coloring collection cover cannot be changed",
      );
    }

    if (
      !Number.isFinite(expectedUpdatedAt.getTime()) ||
      expectedUpdatedAt.getTime() !== current.updatedAt.getTime()
    ) {
      throw new ConflictException("Coloring collection changed concurrently");
    }

    const processed = await this.process(file);
    const fileName = `cover-${processed.checksum}.webp`;
    const storageKey = `coloring-collections/${collectionId}/${fileName}`;
    const url = `${this.getApiPublicUrl()}/uploads/coloring-collections/${collectionId}/${fileName}`;

    await writeImmutableFile({
      root: this.getUploadsRoot(),
      key: storageKey,
      buffer: processed.buffer,
      checksum: processed.checksum,
      sha256: (buffer) => this.sha256(buffer),
    });

    // Content-addressed cover files are intentionally retained when the DB
    // outcome is ambiguous. A separate GC with a grace period can remove
    // unreferenced files without racing concurrent uploads.
    const result = {
      url,
      alt: parsedAlt,
      width: processed.width,
      height: processed.height,
    };
    const nextUpdatedAt = new Date(
      Math.max(Date.now(), expectedUpdatedAt.getTime() + 1),
    );

    let updated: { count: number };

    try {
      updated = await this.prisma.coloringCollection.updateMany({
        where: {
          id: collectionId,
          status: ColoringCollectionStatus.DRAFT,
          updatedAt: expectedUpdatedAt,
        },
        data: {
          coverUrl: result.url,
          coverAlt: result.alt,
          coverWidth: result.width,
          coverHeight: result.height,
          updatedAt: nextUpdatedAt,
        },
      });
    } catch (error) {
      const committed = await this.prisma.coloringCollection
        .findUnique({
          where: { id: collectionId },
          select: {
            coverUrl: true,
            coverAlt: true,
            coverWidth: true,
            coverHeight: true,
            updatedAt: true,
          },
        })
        .catch(() => null);

      if (
        committed?.coverUrl !== result.url ||
        committed.coverAlt !== result.alt ||
        committed.coverWidth !== result.width ||
        committed.coverHeight !== result.height ||
        committed.updatedAt.getTime() !== nextUpdatedAt.getTime()
      ) {
        throw error;
      }

      return result;
    }

    if (updated.count !== 1) {
      throw new ConflictException("Coloring collection changed concurrently");
    }

    return result;
  }

  private async process(file: UploadedColoringCollectionCover) {
    if (
      file.size <= 0 ||
      file.size > maxCoverBytes ||
      file.buffer.length !== file.size
    ) {
      throw new BadRequestException(
        "Coloring collection cover size is invalid",
      );
    }

    if (!this.matchesDeclaredMime(file.buffer, file.mimetype)) {
      throw new BadRequestException(
        "Coloring collection cover must be JPEG, PNG or WebP",
      );
    }

    try {
      const image = sharp(file.buffer, {
        animated: true,
        failOn: "warning",
        limitInputPixels: maxCoverPixels,
        sequentialRead: true,
      }).timeout({ seconds: processingTimeoutSeconds });
      const metadata = await image.metadata();

      if (
        (metadata.pages ?? 1) !== 1 ||
        !metadata.autoOrient.width ||
        !metadata.autoOrient.height ||
        metadata.autoOrient.width > maxCoverSide ||
        metadata.autoOrient.height > maxCoverSide ||
        metadata.autoOrient.width * metadata.autoOrient.height > maxCoverPixels
      ) {
        throw new BadRequestException(
          "Coloring collection cover dimensions are invalid",
        );
      }

      const output = await image
        .autoOrient()
        .flatten({ background: "#ffffff" })
        .toColourspace("srgb")
        .resize(maxOutputSide, maxOutputSide, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .removeAlpha()
        .webp({ effort: 4, quality: 84 })
        .toBuffer({ resolveWithObject: true });

      return {
        buffer: output.data,
        checksum: this.sha256(output.data),
        width: output.info.width,
        height: output.info.height,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException("Coloring collection cover is invalid");
    }
  }

  private matchesDeclaredMime(buffer: Buffer, mimetype: string) {
    if (mimetype === "image/jpeg") {
      return (
        buffer.length >= 3 &&
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff
      );
    }

    if (mimetype === "image/png") {
      return (
        buffer.length >= 8 &&
        buffer
          .subarray(0, 8)
          .equals(
            Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
          )
      );
    }

    if (mimetype === "image/webp") {
      return (
        buffer.length >= 12 &&
        buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
        buffer.subarray(8, 12).toString("ascii") === "WEBP"
      );
    }

    return false;
  }

  private parseAlt(alt: string | undefined) {
    const parsed = alt?.trim();

    if (!parsed || parsed.length > 220) {
      throw new BadRequestException(
        "Coloring collection cover alt must contain 1 to 220 characters",
      );
    }

    return parsed;
  }

  private getUploadsRoot() {
    return join(process.cwd(), "uploads");
  }

  private getApiPublicUrl() {
    return (
      process.env.API_PUBLIC_URL ??
      process.env.API_BASE_URL ??
      `http://localhost:${process.env.PORT ?? "3002"}`
    ).replace(/\/+$/, "");
  }

  private sha256(buffer: Buffer) {
    return createHash("sha256").update(buffer).digest("hex");
  }
}
