/** Workshops-owned DB publication; implemented by workshop_like_subjects_v1. */
export const workshopLikeSubjects = {
  subjectType: "community-work",
  view: "workshop_like_subjects_v1",
  denyOwnerLike: true,
} as const;
