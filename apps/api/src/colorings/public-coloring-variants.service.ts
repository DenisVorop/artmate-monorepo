import { createHash } from "node:crypto";
import { Injectable, NotFoundException } from "@nestjs/common";
import {
  ColoringStatus,
  Prisma,
  ProductStatus,
} from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ColoringStorageService } from "./coloring-storage.service";
import { formatColoringNumber } from "./coloring-number";
import { getColoringPaletteSymbol } from "./coloring-palette";
import {
  isCompleteOriginalPalette,
  publicVariantColoringWhere,
} from "./public-coloring-variant-eligibility";
import type { PublicColoringAssetDescriptor } from "./public-colorings.service";

const productSelect = {
  id: true,
  slug: true,
  title: true,
  status: true,
  category: { select: { id: true, slug: true, title: true } },
} satisfies Prisma.ProductSelect;
const coloringInclude = {
  collection: { include: { product: { select: productSelect } } },
  themes: {
    include: { tag: { select: { id: true, slug: true, title: true } } },
  },
  artwork: {
    include: {
      original: {
        include: { colors: { orderBy: { symbolPosition: "asc" as const } } },
      },
      materialVariants: {
        where: {
          status: ColoringStatus.PUBLISHED,
          publishedAt: { not: null },
          materialSet: { is: { isArchived: false } },
        },
        orderBy: { materialSetId: "asc" as const },
        include: {
          materialSet: {
            include: {
              product: { select: productSelect },
              _count: { select: { colors: true } },
            },
          },
          assignments: {
            orderBy: { symbolPosition: "asc" as const },
            include: { materialColor: true },
          },
        },
      },
    },
  },
} satisfies Prisma.ColoringInclude;
type ColoringRecord = Prisma.ColoringGetPayload<{
  include: typeof coloringInclude;
}>;
type Artwork = NonNullable<ColoringRecord["artwork"]>;
type Original = NonNullable<Artwork["original"]>;
type Variant = Artwork["materialVariants"][number];
type Product = ColoringRecord["collection"]["product"];

// This unique catalog slug is the canonical Artmate 168 set identity, not a brand search.
const defaultMaterialSetSlug = "artmate-168";

@Injectable()
export class PublicColoringVariantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ColoringStorageService,
  ) {}

  async getColoring(collectionSlug: string, number: number) {
    const { coloring, artwork, original, variants } = await this.load(
      collectionSlug,
      number,
    );
    const url = (target: string, kind: string, checksum: string) =>
      `${this.apiUrl()}/colorings/${encodeURIComponent(collectionSlug)}/${formatColoringNumber(number)}/variants/assets/${encodeURIComponent(target)}/${kind}/${checksum}/content`;
    const images = (target: string, record: Original | Variant) => ({
      image: {
        url: url(target, "colored", record.imageChecksum),
        alt: record.imageAlt,
      },
      card: {
        url: url(target, "card", record.cardChecksum),
        alt: record.imageAlt,
        width: record.cardWidth,
        height: record.cardHeight,
      },
    });
    const payload = {
      id: coloring.id,
      number: coloring.number,
      title: coloring.title,
      description: coloring.description!,
      width: artwork.width,
      height: artwork.height,
      defaultPaletteId:
        variants.find((v) => v.materialSet.slug === defaultMaterialSetSlug)
          ?.materialSetId ?? "original",
      outline: {
        url: url("original", "outline", artwork.outlineChecksum),
        alt: artwork.outlineAlt,
      },
      original: {
        id: "original",
        label: "Оригинал",
        ...images("original", original),
        colors: original.colors.map(({ symbolPosition, hex }) => ({
          symbolPosition,
          symbol: getColoringPaletteSymbol(symbolPosition),
          hex,
        })),
      },
      variants: variants.map((variant) => ({
        id: variant.materialSetId,
        label: variant.materialSet.title,
        kind: variant.materialSet.kind,
        totalColors: variant.materialSet._count.colors,
        ...(variant.materialSet.product?.status === ProductStatus.PUBLISHED
          ? { product: this.mapProduct(variant.materialSet.product) }
          : {}),
        ...images(variant.materialSetId, variant),
        colors: variant.assignments.map(
          ({ symbolPosition, materialColor }) => ({
            symbolPosition,
            symbol: getColoringPaletteSymbol(symbolPosition),
            hex: materialColor.hex,
            code: materialColor.code,
          }),
        ),
      })),
      collection: {
        id: coloring.collection.id,
        slug: coloring.collection.slug,
        title: coloring.collection.title,
        product: this.mapProduct(coloring.collection.product),
      },
      themes: coloring.themes
        .map(({ tag }) => tag)
        .sort(
          (a, b) =>
            a.title.localeCompare(b.title, "ru-RU") ||
            a.slug.localeCompare(b.slug) ||
            a.id.localeCompare(b.id),
        ),
      publishedAt: coloring.publishedAt!.toISOString(),
    };
    return {
      ...payload,
      token: createHash("sha256").update(JSON.stringify(payload)).digest("hex"),
    };
  }

  async getAssetDescriptor(
    collectionSlug: string,
    number: number,
    target: string,
    kind: string,
    checksum: string,
  ): Promise<PublicColoringAssetDescriptor> {
    if (
      !/^[a-f0-9]{64}$/.test(checksum) ||
      !["outline", "colored", "card"].includes(kind)
    )
      throw this.notFound();
    const { artwork, original, variants } = await this.load(
      collectionSlug,
      number,
    );
    const record =
      target === "original"
        ? original
        : variants.find((v) => v.materialSetId === target);
    if (!record || (kind === "outline" && target !== "original"))
      throw this.notFound();
    const asset =
      kind === "outline"
        ? {
            key: artwork.outlineStorageKey,
            checksum: artwork.outlineChecksum,
            byteSize: artwork.outlineByteSize,
            width: artwork.width,
            height: artwork.height,
          }
        : kind === "card"
          ? {
              key: record.cardStorageKey,
              checksum: record.cardChecksum,
              byteSize: record.cardByteSize,
              width: record.cardWidth,
              height: record.cardHeight,
            }
          : {
              key: record.imageStorageKey,
              checksum: record.imageChecksum,
              byteSize: record.imageByteSize,
              width: artwork.width,
              height: artwork.height,
            };
    if (asset.checksum !== checksum) throw this.notFound();
    return asset;
  }

  readAsset(asset: PublicColoringAssetDescriptor) {
    return this.storage.readPublic(asset.key, {
      checksum: asset.checksum,
      width: asset.width,
      height: asset.height,
    });
  }

  private async load(collectionSlug: string, number: number) {
    const coloring = await this.prisma.coloring.findFirst({
      where: {
        AND: [
          publicVariantColoringWhere,
          { number, collection: { is: { slug: collectionSlug } } },
        ],
      },
      include: coloringInclude,
    });
    const artwork = coloring?.artwork;
    const original = artwork?.original;
    if (
      !coloring?.description?.trim() ||
      !coloring.publishedAt ||
      !artwork ||
      !original ||
      coloring.status !== ColoringStatus.PUBLISHED ||
      original.status !== ColoringStatus.PUBLISHED ||
      !original.publishedAt ||
      !isCompleteOriginalPalette(original.colors) ||
      !this.completeImage(original) ||
      !artwork.outlineAlt.trim() ||
      !artwork.outlineStorageKey ||
      !artwork.outlineByteSize ||
      !/^[a-f0-9]{64}$/.test(artwork.outlineChecksum) ||
      artwork.width <= 0 ||
      artwork.height <= 0 ||
      !coloring.themes.length ||
      coloring.collection.status !== "PUBLISHED" ||
      !coloring.collection.publishedAt ||
      !coloring.collection.coverUrl?.trim() ||
      !coloring.collection.coverAlt?.trim() ||
      !coloring.collection.coverWidth ||
      coloring.collection.coverWidth <= 0 ||
      !coloring.collection.coverHeight ||
      coloring.collection.coverHeight <= 0 ||
      coloring.collection.product.status !== ProductStatus.PUBLISHED
    )
      throw this.notFound();
    const positions = new Set(
      original.colors.map((color) => color.symbolPosition),
    );
    const variants = artwork.materialVariants.filter(
      (variant) =>
        variant.status === ColoringStatus.PUBLISHED &&
        variant.publishedAt &&
        !variant.materialSet.isArchived &&
        this.completeImage(variant) &&
        variant.assignments.length === positions.size &&
        new Set(variant.assignments.map((a) => a.symbolPosition)).size ===
          positions.size &&
        variant.assignments.every(
          (a) =>
            positions.has(a.symbolPosition) &&
            a.materialSetId === variant.materialSetId &&
            a.materialColor.materialSetId === variant.materialSetId &&
            a.materialColorId === a.materialColor.id &&
            a.materialColor.code.trim() &&
            /^#[0-9a-f]{6}$/i.test(a.materialColor.hex),
        ),
    );
    return { coloring, artwork, original, variants };
  }

  private completeImage(record: Original | Variant) {
    return (
      record.imageAlt.trim() &&
      record.imageStorageKey &&
      record.cardStorageKey &&
      record.imageByteSize > 0 &&
      record.cardByteSize > 0 &&
      record.cardWidth > 0 &&
      record.cardHeight > 0 &&
      /^[a-f0-9]{64}$/.test(record.imageChecksum) &&
      /^[a-f0-9]{64}$/.test(record.cardChecksum)
    );
  }

  private mapProduct(product: Product) {
    return {
      id: product.id,
      slug: product.slug,
      title: product.title,
      ...(product.category ? { category: product.category } : {}),
    };
  }

  private notFound() {
    return new NotFoundException("Coloring not found");
  }
  private apiUrl() {
    return (
      process.env.API_PUBLIC_URL ??
      process.env.API_BASE_URL ??
      `http://localhost:${process.env.PORT ?? "3002"}`
    ).replace(/\/+$/, "");
  }
}
