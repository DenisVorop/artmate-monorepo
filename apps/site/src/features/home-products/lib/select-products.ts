import type { Product } from "@/entities/products";

export function selectHomeProducts(products: readonly Product[]) {
  const albums = products.filter((product) =>
    product.tags.some(
      (tag) => tag.group === "format" && ["po-nomeram", "pikselnye"].includes(tag.slug),
    ),
  );
  const hits = albums.filter((product) => product.isHit).slice(0, 4);
  const others = albums
    .filter((product) => !hits.some((hit) => hit.id === product.id))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return [...hits, ...others].slice(0, 8);
}
