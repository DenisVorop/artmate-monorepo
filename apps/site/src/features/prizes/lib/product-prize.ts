import type { ProductPrize, PrizeProductGroup } from "./types";
import { albumQuantity } from "./format";

export function productGroupQuantity(group: Pick<PrizeProductGroup, "kind" | "quantity">) {
  if (group.kind === "albums") return albumQuantity(group.quantity);
  const q = group.quantity,
    mod100 = q % 100,
    mod10 = q % 10;
  return `${q} ${mod10 === 1 && mod100 !== 11 ? "набор" : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? "набора" : "наборов"} маркеров`;
}
export function selectedPrizeProducts(prize: ProductPrize, ids: string[]) {
  return prize.groups.flatMap((group) =>
    group.products.filter((product) => ids.includes(product.id)),
  );
}
export function isPrizeSelectionComplete(prize: ProductPrize, ids: string[]) {
  const groups = prize.groups;
  if (!groups.length || new Set(ids).size !== ids.length) return false;
  const products = groups.flatMap((group) => group.products);
  if (new Set(products.map((product) => product.id)).size !== products.length) return false;
  if (ids.some((id) => !products.some((product) => product.id === id && product.available)))
    return false;
  return groups.every(
    (group) =>
      Number.isInteger(group.quantity) &&
      group.quantity > 0 &&
      group.products.filter((product) => ids.includes(product.id)).length === group.quantity,
  );
}
