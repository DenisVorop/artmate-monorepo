import type { Product } from "@/entities/products";

export function hasAlbumOffer(products: readonly Product[], percent: number) {
  const albums = products.filter((product) =>
    product.tags.some(
      (tag) => tag.group === "format" && ["po-nomeram", "pikselnye"].includes(tag.slug),
    ),
  );

  return (
    albums.length > 0 &&
    albums.every(
      (product) =>
        Number.isFinite(product.price) &&
        product.price >= 0 &&
        product.originalPrice !== undefined &&
        Number.isFinite(product.originalPrice) &&
        product.originalPrice > product.price &&
        Math.floor(((product.originalPrice - product.price) / product.originalPrice) * 100) ===
          percent,
    )
  );
}
