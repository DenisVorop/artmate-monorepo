"use client";

import { useQuery } from "@tanstack/react-query";
import type { LikeSubject } from "@/shared/actions/likes";
import { likesQuery } from "./query";

export function useLikeState(subject: LikeSubject, owner: string) {
  const { data, isPending, isError, refetch } = useQuery(likesQuery.state(subject, owner));
  return { data, isPending, isError, refetch };
}
