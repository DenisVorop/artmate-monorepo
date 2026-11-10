import { createAnalytics, createGoalCommand, type YandexGoalParams } from "@/shared/lib/analytics";

type SubjectType = YandexGoalParams["like_added"]["subject_type"];
const analytics = createAnalytics({
  likeAdded: (subjectType: SubjectType) =>
    createGoalCommand("like_added", { subject_type: subjectType }),
  likeRemoved: (subjectType: SubjectType) =>
    createGoalCommand("like_removed", { subject_type: subjectType }),
});

export function useAnalytics(subjectType: string) {
  const supported = subjectType === "community-work" || subjectType === "blog-post";
  return {
    likeAdded: () => {
      if (supported) analytics.send("likeAdded", subjectType);
    },
    likeRemoved: () => {
      if (supported) analytics.send("likeRemoved", subjectType);
    },
  };
}
