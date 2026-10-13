import { randomBytes } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  Prisma,
  ColoringStatus,
  ColoringCollectionStatus,
  ProductStatus,
} from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { currentColoringDerivativeProfile } from "./coloring-derivative-profile";
import {
  ColoringMediaService,
  type ProcessedColoringPair,
  type UploadedColoringFile,
} from "./coloring-media.service";
import { ColoringStorageService } from "./coloring-storage.service";
import {
  type ColoringVariantsDTO,
  type SaveColoringVariantDTO,
  type PublishColoringVariantDTO,
} from "./dto/coloring-variant.dto";

const artworkInclude = {
  original: {
    include: { colors: { orderBy: { symbolPosition: "asc" as const } } },
  },
  materialVariants: {
    orderBy: { materialSetId: "asc" as const },
    include: {
      materialSet: { select: { title: true } },
      assignments: {
        orderBy: { symbolPosition: "asc" as const },
        include: { materialColor: true },
      },
    },
  },
} satisfies Prisma.ColoringArtworkInclude;
type Artwork = Prisma.ColoringArtworkGetPayload<{
  include: typeof artworkInclude;
}>;
type Db = Prisma.TransactionClient;
export type VariantUploadFiles = {
  outline?: UploadedColoringFile[];
  colored?: UploadedColoringFile[];
};

function conflict(errorCode: string, message: string): never {
  throw new ConflictException({ errorCode, message });
}
function invalid(errorCode: string, message: string): never {
  throw new BadRequestException({ errorCode, message });
}

@Injectable()
export class ColoringVariantsService {
  private readonly logger = new Logger(ColoringVariantsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: ColoringMediaService,
    private readonly storage: ColoringStorageService,
  ) {}

  async get(coloringId: string): Promise<ColoringVariantsDTO> {
    await this.requireColoring(this.prisma, coloringId);
    return this.map(coloringId, await this.load(this.prisma, coloringId));
  }

  async save(
    coloringId: string,
    input: SaveColoringVariantDTO,
    files: VariantUploadFiles | undefined,
  ) {
    const outline = files?.outline?.[0];
    const colored = files?.colored?.[0];
    if (
      !outline ||
      !colored ||
      files?.outline?.length !== 1 ||
      files?.colored?.length !== 1
    ) {
      invalid("IMAGE_INVALID", "Загрузите контуры и цветную картинку.");
    }
    // Cheap validation before decoding/writing; repeat under a row lock at commit.
    await this.validate(this.prisma, coloringId, input);
    let pair: ProcessedColoringPair;
    try {
      pair = await this.media.processPair(outline, colored);
    } catch (error) {
      if (error instanceof BadRequestException)
        invalid(
          "IMAGE_INVALID",
          "Не удалось обработать изображения. Проверьте формат и одинаковый размер файлов.",
        );
      throw error;
    }
    const before = await this.validate(this.prisma, coloringId, input, pair);
    // A random upload namespace is a cache key, not a historical revision.
    // No endpoint accepts caller-supplied storage paths or reattaches retired keys.
    const uploadId = randomBytes(16).toString("hex");
    const key = (kind: string, checksum: string) =>
      `${coloringId}/${uploadId}/${kind}-${checksum}.webp`;
    const previousContour =
      input.target === "original"
        ? before
        : before?.materialVariants.find(
            (v) => v.materialSetId === input.target,
          );
    const keepOutline =
      previousContour?.outlineChecksum === pair.outline.checksum;
    const outlineKey = keepOutline
      ? previousContour!.outlineStorageKey
      : key("outline", pair.outline.checksum);
    const imageKey = key("colored", pair.colored.checksum);
    const cardKey = key("card", pair.card.checksum);
    const stored = await this.storage.writePrivatePair([
      // Verify an existing contour too; restore its private file if missing.
      { key: outlineKey, ...pair.outline },
      { key: imageKey, ...pair.colored },
      { key: cardKey, ...pair.card },
    ]);
    let result: Artwork | null = null;
    const retired: string[] = [];
    try {
      const previousTarget =
        input.target === "original"
          ? before?.original
          : before?.materialVariants.find(
              (v) => v.materialSetId === input.target,
            );
      if (previousTarget?.status === ColoringStatus.PUBLISHED) {
        await this.storage.materializePublicPair([
          {
            key: outlineKey,
            checksum: pair.outline.checksum,
            width: pair.width,
            height: pair.height,
          },
          {
            key: imageKey,
            checksum: pair.colored.checksum,
            width: pair.width,
            height: pair.height,
          },
          {
            key: cardKey,
            checksum: pair.card.checksum,
            width: pair.card.width,
            height: pair.card.height,
          },
        ]);
      }
      result = await this.prisma.$transaction(async (tx) => {
        // Shared with the legacy workflow: parent archive/publication cannot race us.
        await tx.$queryRaw`SELECT c.id FROM colorings c
          JOIN coloring_collections cc ON cc.id = c.collection_id
          WHERE c.id = ${coloringId} FOR UPDATE OF c, cc`;
        if (input.target !== "original") {
          await tx.$queryRaw`SELECT id FROM material_sets WHERE id = ${input.target} FOR UPDATE`;
        }
        const current = await this.validate(tx, coloringId, input, pair);
        const previous =
          input.target === "original"
            ? current?.original
            : current?.materialVariants.find(
                (v) => v.materialSetId === input.target,
              );
        if (previous)
          retired.push(previous.imageStorageKey, previous.cardStorageKey);
        const currentContour =
          input.target === "original"
            ? current
            : current?.materialVariants.find(
                (v) => v.materialSetId === input.target,
              );
        if (currentContour && currentContour.outlineStorageKey !== outlineKey)
          retired.push(currentContour.outlineStorageKey);
        // Monotonic even when two uploads commit within one millisecond.
        const updatedAt = new Date(
          Math.max(Date.now(), (current?.updatedAt.getTime() ?? 0) + 1),
        );
        const artwork = {
          width: pair.width,
          height: pair.height,
          derivativeProfile: currentColoringDerivativeProfile,
          colorSpace: "srgb",
          outlineStorageKey: outlineKey,
          outlineChecksum: pair.outline.checksum,
          outlineByteSize: pair.outline.byteSize,
          outlineSourceChecksum: pair.outline.sourceChecksum,
          outlineSourceMime: pair.outline.sourceMime,
          outlineAlt: input.outlineAlt,
          updatedAt,
        };
        if (input.target === "original") {
          await tx.coloringArtwork.upsert({
            where: { coloringId },
            create: { coloringId, ...artwork },
            update: artwork,
          });
        } else {
          // The original contour owns the shared artwork geometry. Material
          // uploads only replace their own paired contour and bump the token.
          await tx.coloringArtwork.update({
            where: { coloringId },
            data: { updatedAt },
          });
        }
        const image = {
          imageStorageKey: imageKey,
          imageChecksum: pair.colored.checksum,
          imageByteSize: pair.colored.byteSize,
          sourceChecksum: pair.colored.sourceChecksum,
          sourceMime: pair.colored.sourceMime,
          imageAlt: input.imageAlt,
          cardStorageKey: cardKey,
          cardChecksum: pair.card.checksum,
          cardByteSize: pair.card.byteSize,
          cardWidth: pair.card.width,
          cardHeight: pair.card.height,
          updatedAt,
        };
        if (input.target === "original") {
          const colors = input.palette.map((row) => ({
            symbolPosition: row.symbolPosition,
            hex: row.hex!.toUpperCase(),
          }));
          await tx.coloringOriginal.upsert({
            where: { coloringId },
            create: { coloringId, ...image, colors: { create: colors } },
            update: { ...image, colors: { deleteMany: {}, create: colors } },
          });
        } else {
          const contour = {
            outlineStorageKey: outlineKey,
            outlineChecksum: pair.outline.checksum,
            outlineByteSize: pair.outline.byteSize,
            outlineSourceChecksum: pair.outline.sourceChecksum,
            outlineSourceMime: pair.outline.sourceMime,
            outlineAlt: input.outlineAlt,
          };
          const assignments = input.palette.map((row) => ({
            symbolPosition: row.symbolPosition,
            materialSetId: input.target,
            materialColorId: row.materialColorId!,
          }));
          await tx.coloringMaterialVariant.upsert({
            where: {
              coloringId_materialSetId: {
                coloringId,
                materialSetId: input.target,
              },
            },
            create: {
              coloringId,
              materialSetId: input.target,
              ...image,
              ...contour,
              assignments: { create: assignments },
            },
            update: {
              ...image,
              ...contour,
              assignments: { deleteMany: {}, create: assignments },
            },
          });
        }
        return this.load(tx, coloringId);
      });
    } catch (error) {
      // COMMIT acknowledgement can be lost. Never unlink until a fresh DB read
      // proves our new keys are unreferenced. On DB outage retain files safely.
      try {
        const current = await this.load(this.prisma, coloringId);
        const saved =
          input.target === "original"
            ? current?.original
            : current?.materialVariants.find(
                (v) => v.materialSetId === input.target,
              );
        const savedContour =
          input.target === "original"
            ? current
            : current?.materialVariants.find(
                (v) => v.materialSetId === input.target,
              );
        if (
          saved?.imageStorageKey === imageKey &&
          saved.cardStorageKey === cardKey &&
          savedContour?.outlineStorageKey === outlineKey
        )
          result = current;
        else
          await this.cleanupUnused(
            stored.filter((f) => f.created).map((f) => f.key),
          );
      } catch {
        this.logger.warn(
          "Upload outcome unknown; retaining coloring files for reconciliation",
        );
      }
      if (!result) throw error;
    }
    await this.cleanupUnused(retired);
    return this.map(coloringId, result);
  }

  async publish(
    coloringId: string,
    target: string,
    input: PublishColoringVariantDTO,
    actorId: string,
  ) {
    let expectedImageKey: string | undefined;
    let attemptedPublication = false;
    let result: Artwork | null = null;
    try {
      result = await this.prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT c.id FROM colorings c
          JOIN coloring_collections cc ON cc.id = c.collection_id
          JOIN products p ON p.id = cc.product_id
          WHERE c.id = ${coloringId} FOR UPDATE OF c, cc, p`;
          if (target !== "original")
            await tx.$queryRaw`SELECT id FROM material_sets WHERE id = ${target} FOR UPDATE`;
          const artwork = await this.load(tx, coloringId);
          if (!artwork)
            throw new NotFoundException("Сначала загрузите изображение.");
          const image =
            target === "original"
              ? artwork.original
              : artwork.materialVariants.find(
                  (v) => v.materialSetId === target,
                );
          if (!image) throw new NotFoundException("Вариант не найден.");
          const contour =
            target === "original"
              ? artwork
              : artwork.materialVariants.find(
                  (v) => v.materialSetId === target,
                )!;
          await this.validate(tx, coloringId, {
            target,
            expectedToken: input.expectedToken,
            outlineAlt: contour.outlineAlt,
            imageAlt: image.imageAlt,
            palette:
              target === "original"
                ? artwork.original!.colors.map((c) => ({
                    symbolPosition: c.symbolPosition,
                    hex: c.hex,
                  }))
                : artwork.materialVariants
                    .find((v) => v.materialSetId === target)!
                    .assignments.map((a) => ({
                      symbolPosition: a.symbolPosition,
                      materialColorId: a.materialColorId,
                    })),
          });
          const coloring = await tx.coloring.findUnique({
            where: { id: coloringId },
            select: {
              description: true,
              publishedAt: true,
              themes: { select: { tagId: true } },
              collection: { select: { product: { select: { status: true } } } },
            },
          });
          if (
            !coloring?.description?.trim() ||
            !coloring.themes.length ||
            coloring.collection.product.status !== ProductStatus.PUBLISHED
          ) {
            invalid(
              "PUBLICATION_NOT_READY",
              "Перед публикацией заполните описание и тематику картинки и опубликуйте товар альбома.",
            );
          }
          if (
            target !== "original" &&
            artwork.original?.status !== ColoringStatus.PUBLISHED
          )
            invalid("ORIGINAL_NOT_PUBLISHED", "Сначала опубликуйте оригинал.");
          expectedImageKey = image.imageStorageKey;
          // All files are decoded/verified before any published row is exposed.
          await this.storage.materializePublicPair([
            {
              key: contour.outlineStorageKey,
              checksum: contour.outlineChecksum,
              width: artwork.width,
              height: artwork.height,
            },
            {
              key: image.imageStorageKey,
              checksum: image.imageChecksum,
              width: artwork.width,
              height: artwork.height,
            },
            {
              key: image.cardStorageKey,
              checksum: image.cardChecksum,
              width: image.cardWidth,
              height: image.cardHeight,
            },
          ]);
          if (image.status === ColoringStatus.PUBLISHED) return artwork;
          attemptedPublication = true;
          const updatedAt = new Date(
            Math.max(Date.now(), artwork.updatedAt.getTime() + 1),
          );
          const data = {
            status: ColoringStatus.PUBLISHED,
            publishedAt: updatedAt,
            updatedAt,
          };
          if (target === "original") {
            await tx.coloringOriginal.update({ where: { coloringId }, data });
            await tx.coloring.update({
              where: { id: coloringId },
              data: {
                status: ColoringStatus.PUBLISHED,
                publishedAt: coloring.publishedAt ?? updatedAt,
                publishedById: actorId,
              },
            });
          } else {
            await tx.coloringMaterialVariant.update({
              where: {
                coloringId_materialSetId: { coloringId, materialSetId: target },
              },
              data,
            });
          }
          await tx.coloringArtwork.update({
            where: { coloringId },
            data: { updatedAt },
          });
          return this.load(tx, coloringId);
        },
        { timeout: 30000 },
      );
    } catch (error) {
      if (expectedImageKey && attemptedPublication) {
        try {
          const current = await this.load(this.prisma, coloringId);
          const image =
            target === "original"
              ? current?.original
              : current?.materialVariants.find(
                  (v) => v.materialSetId === target,
                );
          if (
            image?.status === ColoringStatus.PUBLISHED &&
            image.imageStorageKey === expectedImageKey
          )
            result = current;
        } catch {
          this.logger.warn(
            "Publication outcome unknown; retaining files for reconciliation",
          );
        }
      }
      // Current rows still own copied files. No destructive rollback on lost ACK.
      if (!result) throw error;
    }
    return this.map(coloringId, result);
  }

  async asset(coloringId: string, target: string, kind: string) {
    if (!["outline", "colored", "card"].includes(kind))
      throw new BadRequestException("Unknown asset kind");
    const artwork = await this.load(this.prisma, coloringId);
    if (!artwork) throw new NotFoundException("Изображение не найдено.");
    const image =
      target === "original"
        ? artwork.original
        : artwork.materialVariants.find((v) => v.materialSetId === target);
    if (!image) throw new NotFoundException("Изображение не найдено.");
    const contour =
      target === "original"
        ? artwork
        : artwork.materialVariants.find((v) => v.materialSetId === target)!;
    if (kind === "outline")
      return this.storage.readProtected(contour.outlineStorageKey, {
        checksum: contour.outlineChecksum,
        width: artwork.width,
        height: artwork.height,
      });
    return kind === "card"
      ? this.storage.readProtected(image.cardStorageKey, {
          checksum: image.cardChecksum,
          width: image.cardWidth,
          height: image.cardHeight,
        })
      : this.storage.readProtected(image.imageStorageKey, {
          checksum: image.imageChecksum,
          width: artwork.width,
          height: artwork.height,
        });
  }

  private load(db: Db, coloringId: string) {
    return db.coloringArtwork.findUnique({
      where: { coloringId },
      include: artworkInclude,
    });
  }

  private async requireColoring(db: Db, coloringId: string) {
    const coloring = await db.coloring.findUnique({
      where: { id: coloringId },
      select: { status: true, collection: { select: { status: true } } },
    });
    if (!coloring) throw new NotFoundException("Раскраска не найдена.");
    return coloring;
  }

  private async validate(
    db: Db,
    coloringId: string,
    input: SaveColoringVariantDTO,
    pair?: ProcessedColoringPair,
  ) {
    const coloring = await this.requireColoring(db, coloringId);
    if (
      coloring.status === ColoringStatus.ARCHIVED ||
      coloring.collection.status === ColoringCollectionStatus.ARCHIVED
    )
      conflict("COLORING_ARCHIVED", "Раскраска или альбом в архиве.");
    const current = await this.load(db, coloringId);
    if (input.expectedToken !== (current?.updatedAt.toISOString() ?? "new"))
      conflict(
        "STALE_UPLOAD",
        "Картинка уже изменена. Обновите страницу перед загрузкой.",
      );
    const positions = input.palette
      .map((row) => row.symbolPosition)
      .sort((a, b) => a - b);
    if (
      !positions.length ||
      positions.length > 19 ||
      positions.some((p) => !Number.isInteger(p) || p < 1 || p > 19) ||
      new Set(positions).size !== positions.length
    )
      invalid("PALETTE_INVALID", "Проверьте обозначения в палитре.");
    if (input.target === "original") {
      if (
        input.palette.some(
          (row) =>
            typeof row.hex !== "string" ||
            !/^#[0-9a-f]{6}$/i.test(row.hex) ||
            row.materialColorId !== undefined,
        )
      )
        invalid(
          "PALETTE_INVALID",
          "Для каждого обозначения оригинала укажите цвет.",
        );
      if (current?.original?.status === ColoringStatus.ARCHIVED)
        conflict(
          "VARIANT_ARCHIVED",
          "Этот вариант в архиве. Его замена недоступна.",
        );
      if (
        current?.materialVariants.length &&
        positions.join() !==
          current.original?.colors.map((c) => c.symbolPosition).join()
      )
        conflict(
          "SYMBOLS_IN_USE",
          "Обозначения используются в других вариантах. Сохраните прежний список обозначений.",
        );
    } else {
      if (!current?.original)
        invalid("ORIGINAL_REQUIRED", "Сначала загрузите оригинал.");
      const variant = current.materialVariants.find(
        (v) => v.materialSetId === input.target,
      );
      if (variant?.status === ColoringStatus.ARCHIVED)
        conflict(
          "VARIANT_ARCHIVED",
          "Этот вариант в архиве. Его замена недоступна.",
        );
      if (
        positions.join() !==
          current.original.colors.map((c) => c.symbolPosition).join() ||
        input.palette.some(
          (row) => row.hex !== undefined || !row.materialColorId,
        )
      )
        invalid(
          "PALETTE_INVALID",
          "Заполните все обозначения оригинала цветами выбранного набора.",
        );
      const set = await db.materialSet.findUnique({
        where: { id: input.target },
        select: { isArchived: true, colors: { select: { id: true } } },
      });
      if (!set)
        invalid(
          "MATERIAL_COLOR_INVALID",
          "Набор не найден. Обновите список наборов.",
        );
      if (set.isArchived)
        conflict(
          "MATERIAL_SET_ARCHIVED",
          "Этот набор в архиве. Выберите другой набор.",
        );
      const ids = new Set(set.colors.map((c) => c.id));
      if (input.palette.some((row) => !ids.has(row.materialColorId!)))
        invalid(
          "MATERIAL_COLOR_INVALID",
          "Выберите цвета из указанного набора.",
        );
    }
    if (
      pair &&
      current &&
      (pair.width !== current.width || pair.height !== current.height)
    ) {
      conflict(
        "OUTLINE_IN_USE",
        "Размеры изображений должны совпадать с оригиналом.",
      );
    }
    if (
      pair &&
      current &&
      input.target === "original" &&
      current.materialVariants.length > 0 &&
      pair.outline.checksum !== current.outlineChecksum
    ) {
      conflict(
        "OUTLINE_IN_USE",
        "Контуры оригинала используются в других вариантах. Сохраните прежние контуры.",
      );
    }
    return current;
  }

  private map(
    coloringId: string,
    artwork: Artwork | null,
  ): ColoringVariantsDTO {
    const token = artwork?.updatedAt.toISOString() ?? "new";
    const url = (target: string, kind: string) =>
      `/admin/colorings/${coloringId}/variants/assets/${target}/${kind}/content?token=${encodeURIComponent(token)}`;
    return {
      coloringId,
      token,
      width: artwork?.width ?? null,
      height: artwork?.height ?? null,
      original: artwork?.original
        ? {
            updatedAt: artwork.original.updatedAt.toISOString(),
            status: artwork.original.status.toLowerCase() as
              | "draft"
              | "published"
              | "archived",
            outlineUrl: url("original", "outline"),
            imageUrl: url("original", "colored"),
            cardUrl: url("original", "card"),
            palette: artwork.original.colors.map(({ symbolPosition, hex }) => ({
              symbolPosition,
              hex,
            })),
          }
        : null,
      variants:
        artwork?.materialVariants.map((v) => ({
          materialSetId: v.materialSetId,
          title: v.materialSet.title,
          updatedAt: v.updatedAt.toISOString(),
          status: v.status.toLowerCase() as "draft" | "published" | "archived",
          outlineUrl: url(v.materialSetId, "outline"),
          imageUrl: url(v.materialSetId, "colored"),
          cardUrl: url(v.materialSetId, "card"),
          palette: v.assignments.map((a) => ({
            symbolPosition: a.symbolPosition,
            materialColorId: a.materialColorId,
            code: a.materialColor.code,
            hex: a.materialColor.hex,
          })),
        })) ?? [],
    };
  }

  private async cleanupUnused(keys: string[]) {
    try {
      for (const key of new Set(keys)) {
        const counts = await Promise.all([
          this.prisma.coloringArtwork.count({
            where: { outlineStorageKey: key },
          }),
          this.prisma.coloringOriginal.count({
            where: { OR: [{ imageStorageKey: key }, { cardStorageKey: key }] },
          }),
          this.prisma.coloringMaterialVariant.count({
            where: {
              OR: [
                { outlineStorageKey: key },
                { imageStorageKey: key },
                { cardStorageKey: key },
              ],
            },
          }),
          this.prisma.coloringRevision.count({
            where: {
              OR: [
                { outlineStorageKey: key },
                { coloredStorageKey: key },
                { cardStorageKey: key },
              ],
            },
          }),
        ]);
        // Only unreferenced project assets; never workshop or revision-owned files.
        if (counts.every((count) => count === 0)) {
          await this.storage.cleanupPrivate([key]);
          await this.storage.cleanupPublic([{ key, created: true }]);
        }
      }
    } catch {
      this.logger.warn(
        "Could not verify unused coloring assets; manual reconciliation required",
      );
    }
  }
}
