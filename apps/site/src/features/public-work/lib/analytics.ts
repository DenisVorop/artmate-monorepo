import { createAnalytics, createGoalCommand } from "@/shared/lib/analytics";

const analytics = createAnalytics({
  photoViewed: (workId: string) => createGoalCommand("gallery_photo_view", { work_id: workId }),
  digitalPictureClicked: (slug: string, number: number) =>
    createGoalCommand("digital_picture_link_click", {
      source: "gallery",
      collection_slug: slug,
      coloring_number: number,
    }),
  workShared: (workId: string) => createGoalCommand("gallery_work_shared", { work_id: workId }),
  linkCopied: (workId: string) => createGoalCommand("gallery_link_copied", { work_id: workId }),
});

const actions = {
  photoViewed: (workId: string) => analytics.send("photoViewed", workId),
  digitalPictureClicked: (slug: string, number: number) =>
    analytics.send("digitalPictureClicked", slug, number),
  workShared: (workId: string) => analytics.send("workShared", workId),
  linkCopied: (workId: string) => analytics.send("linkCopied", workId),
};

export function useAnalytics() {
  return actions;
}
