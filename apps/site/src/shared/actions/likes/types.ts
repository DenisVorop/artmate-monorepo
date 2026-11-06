export type LikeSubject = { subjectType: string; subjectId: string };
export type LikeState = LikeSubject & {
  count: number;
  viewerHasLiked: boolean;
  canLike: boolean;
};
