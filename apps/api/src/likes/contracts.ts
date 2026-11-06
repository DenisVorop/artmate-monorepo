import type { Prisma } from "../generated/prisma/client";

export type LikeSubject = { subjectType: string; subjectId: string };
export type PublishedLikeSubject = {
  subjectId: string;
  ownerId: string | null;
  isPublic: boolean;
  isDeleted: boolean;
};
export type LikeState = LikeSubject & {
  count: number;
  viewerHasLiked: boolean;
  canLike: boolean;
};

export type LikeReader = Pick<Prisma.TransactionClient, "$queryRaw">;

/** A registered, owner-published DB contract. Never accepts view names from HTTP. */
export type LikeSubjectPublication = {
  subjectType: string;
  view: string;
  denyOwnerLike: boolean;
};

export const likeSubjectPublications = Symbol("like-subject-publications");
