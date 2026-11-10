import { createAnalytics, createGoalCommand } from "@/shared/lib/analytics";

const analytics = createAnalytics({
  imageViewed: (slug: string, imageId: string) =>
    createGoalCommand("blog_image_view", { article_slug: slug, image_id: imageId }),
  linkCopied: (slug: string) => createGoalCommand("blog_link_copied", { article_slug: slug }),
  telegramShareClicked: (slug: string) =>
    createGoalCommand("blog_telegram_share_click", { article_slug: slug }),
});

export function useAnalytics(slug: string) {
  return {
    imageViewed: (imageId: string) => analytics.send("imageViewed", slug, imageId),
    linkCopied: () => analytics.send("linkCopied", slug),
    telegramShareClicked: () => analytics.send("telegramShareClicked", slug),
  };
}
