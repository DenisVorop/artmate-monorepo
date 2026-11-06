/** Blog-owned DB publication; editor identity must not be treated as authorship. */
export const blogLikeSubjects = {
  subjectType: "blog-post",
  view: "blog_like_subjects_v1",
  denyOwnerLike: false,
} as const;
