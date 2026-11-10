import { createAnalytics, createGoalCommand, type YandexGoalParams } from "@/shared/lib/analytics";

type Picture = YandexGoalParams["digital_picture_image_view"];

const analytics = createAnalytics({
  pictureRetried: (picture: Picture) => createGoalCommand("digital_picture_retry", picture),
  printAlbumClicked: (slug: string, productId: string) =>
    createGoalCommand("digital_print_album_click", { collection_slug: slug, product_id: productId }),
  pictureViewed: (picture: Picture) => createGoalCommand("digital_picture_image_view", picture),
  comparisonMoved: (picture: Picture, percent: number) =>
    createGoalCommand("digital_compare_moved", { ...picture, percent: Math.round(percent) }),
  leftShown: (picture: Picture) => createGoalCommand("digital_show_left", picture),
  rightShown: (picture: Picture) => createGoalCommand("digital_show_right", picture),
  imageRetried: (picture: Picture) => createGoalCommand("digital_image_retry", picture),
  coloringOpened: (collectionSlug: string, coloringNumber: number, viewKey: string) =>
    createGoalCommand(
      "digital_coloring_open",
      {
        collection_slug: collectionSlug,
        coloring_number: coloringNumber,
      },
      { scope: "memory", entityKey: viewKey },
    ),
});

const coloringAnalytics = {
  opened(collectionSlug: string, coloringNumber: number, viewKey: string) {
    const normalizedSlug = collectionSlug.trim();

    if (
      normalizedSlug &&
      Number.isInteger(coloringNumber) &&
      coloringNumber > 0 &&
      viewKey.trim()
    ) {
      analytics.send("coloringOpened", normalizedSlug, coloringNumber, viewKey);
    }
  },
};

export function useAnalytics() {
  return coloringAnalytics;
}

export function useViewerAnalytics(collectionSlug: string, coloringNumber: number) {
  const picture = { collection_slug: collectionSlug, coloring_number: coloringNumber };
  return {
    pictureRetried: () => analytics.send("pictureRetried", picture),
    printAlbumClicked: (productId: string) => analytics.send("printAlbumClicked", collectionSlug, productId),
    pictureViewed: () => analytics.send("pictureViewed", picture),
    comparisonMoved: (percent: number) => analytics.send("comparisonMoved", picture, percent),
    leftShown: () => analytics.send("leftShown", picture),
    rightShown: () => analytics.send("rightShown", picture),
    imageRetried: () => analytics.send("imageRetried", picture),
  };
}
