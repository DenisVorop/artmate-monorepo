export function getCommunityCollectionTitle(title: string) {
  return /«(.+)»/.exec(title)?.[1] ?? title;
}

export function getGalleryCollectionSlug(collectionSlug: string) {
  return collectionSlug.replace(/^cifrovaya-raskraska-/, "");
}
