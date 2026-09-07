import type { ColoringCollection } from "@/entities/coloring-collection";

type CollectionPresentationSource = Pick<ColoringCollection, "product" | "title">;

export function getDigitalCollectionPresentation(collection: CollectionPresentationSource) {
  const quotedTitle =
    collection.product.title.match(/«([^»]+)»/)?.[1]?.trim() ||
    collection.title.match(/«([^»]+)»/)?.[1]?.trim();
  const albumTitle = quotedTitle || collection.title.trim() || collection.product.title.trim() || "Artmate";

  return {
    albumTitle,
    heading: `${albumTitle} — цифровая версия`,
    instruction: `Выберите картину из альбома «${albumTitle}», чтобы открыть цветной образец, контур и палитру с номерами маркеров Artmate.`,
  };
}
