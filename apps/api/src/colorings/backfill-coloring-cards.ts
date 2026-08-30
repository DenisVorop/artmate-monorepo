import "dotenv/config";

import { createHash } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import sharp from "sharp";

import { PrismaClient } from "../generated/prisma/client";

import { ColoringMediaService } from "./coloring-media.service";
import { ColoringStorageService } from "./coloring-storage.service";

const maxCardSide = 640;
const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: getRequiredEnv("DATABASE_URL"),
  }),
});
const media = new ColoringMediaService();
const storage = new ColoringStorageService(media);

async function main() {
  const revisions = await prisma.coloringRevision.findMany({
    where: { cardStorageKey: null },
    select: {
      id: true,
      coloringId: true,
      width: true,
      height: true,
      coloredStorageKey: true,
      coloredChecksum: true,
      firstPublishedAt: true,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  let backfilled = 0;

  for (const revision of revisions) {
    const colored = await storage.readProtected(revision.coloredStorageKey, {
      checksum: revision.coloredChecksum,
      width: revision.width,
      height: revision.height,
    });
    const card = await createCard(colored);
    const cardStorageKey = `${revision.coloringId}/${revision.id}/card-${card.checksum}.webp`;

    await storage.writePrivatePair([
      {
        key: cardStorageKey,
        buffer: card.buffer,
        checksum: card.checksum,
      },
    ]);

    if (revision.firstPublishedAt) {
      await storage.materializePublicPair([
        {
          key: cardStorageKey,
          checksum: card.checksum,
          width: card.width,
          height: card.height,
        },
      ]);
    }

    const updated = await prisma.coloringRevision.updateMany({
      where: { id: revision.id, cardStorageKey: null },
      data: {
        cardStorageKey,
        cardByteSize: card.buffer.length,
        cardChecksum: card.checksum,
        cardWidth: card.width,
        cardHeight: card.height,
      },
    });

    if (updated.count === 1) {
      backfilled += 1;

      if (revision.firstPublishedAt) {
        await storage.cleanupPrivate([cardStorageKey]);
      }
    }
  }

  console.log(
    JSON.stringify({ scanned: revisions.length, backfilled }, null, 2),
  );
}

async function createCard(colored: Buffer) {
  const output = await sharp(colored, {
    animated: false,
    failOn: "warning",
    limitInputPixels: 24_000_000,
    sequentialRead: true,
  })
    .resize(maxCardSide, maxCardSide, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .toColourspace("srgb")
    .removeAlpha()
    .webp({ effort: 4, quality: 78 })
    .toBuffer({ resolveWithObject: true });
  const checksum = createHash("sha256").update(output.data).digest("hex");

  await media.verifyDerivative(output.data, {
    checksum,
    width: output.info.width,
    height: output.info.height,
  });

  return {
    buffer: output.data,
    checksum,
    width: output.info.width,
    height: output.info.height,
  };
}

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
