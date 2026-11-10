import { createAnalytics, createGoalCommand } from "@/shared/lib/analytics";

const analytics = createAnalytics({
  photoOpened: (id: string) => createGoalCommand("gallery_photo_open", { work_id: id }),
  photoClosed: (id: string) => createGoalCommand("gallery_photo_close", { work_id: id }),
  photoViewed: (workId: string) => createGoalCommand("gallery_photo_view", { work_id: workId }),
  digitalPictureClicked: (slug: string, number: number) =>
    createGoalCommand("digital_picture_link_click", {
      source: "gallery",
      collection_slug: slug,
      coloring_number: number,
    }),
});

const actions = {
  photoOpened: (id: string) => analytics.send("photoOpened", id),
  photoClosed: (id: string) => analytics.send("photoClosed", id),
  photoViewed: (workId: string) => analytics.send("photoViewed", workId),
  digitalPictureClicked: (slug: string, number: number) =>
    analytics.send("digitalPictureClicked", slug, number),
};

export function useAnalytics() {
  return actions;
}
