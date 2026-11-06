"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/features/auth";
import { likesQuery, useLikeState, type LikeSubject } from "@/entities/likes";
import { useSession } from "@/entities/session";
import { getQueryOwner } from "@/shared/lib/query-keys";
import { useSetLike } from "../model/use-set-like";

export function useLikeAction(subject: LikeSubject) {
  const { user, isPending: isSessionPending } = useSession();
  const query = useLikeState(subject, getQueryOwner(user?.id));
  const mutation = useSetLike(subject);
  const { onAuth, isPending: isAuthPending } = useAuth({});
  const client = useQueryClient();
  const [isContinuingAuth, setContinuingAuth] = useState(false);
  const unknown = isSessionPending || query.isPending;
  const busy = mutation.isPending || isAuthPending || isContinuingAuth;
  const failed = query.isError;
  const unavailable = !unknown && !failed && !query.data;
  const liked = !failed && query.data?.viewerHasLiked;
  const count = query.data?.count ?? 0;

  async function onClick() {
    if (busy || unknown || unavailable) return;
    if (failed) {
      await query.refetch();
      return;
    }
    let mutationStarted = false;
    try {
      if (user) {
        if (query.data?.canLike) {
          mutationStarted = true;
          await mutation.mutate({ actorId: user.id, liked: !query.data.viewerHasLiked });
        }
        return;
      }
      setContinuingAuth(true);
      const outcome = await onAuth();
      if (outcome.status !== "success") return;
      const state = await client.fetchQuery({
        ...likesQuery.state(subject, outcome.user.id),
        staleTime: 0,
      });
      // The original guest intent is to add a like, never toggle an existing one.
      if (state?.canLike && !state.viewerHasLiked) {
        mutationStarted = true;
        await mutation.mutate({ actorId: outcome.user.id, liked: true });
      }
    } catch {
      // Mutation errors already carry contextual recovery. An auth continuation's
      // fresh read can fail before the mutation starts.
      if (!mutationStarted) toast.error("Не удалось поставить лайк. Попробуйте ещё раз.");
    } finally {
      setContinuingAuth(false);
    }
  }

  return { user, data: query.data, unknown, busy, failed, unavailable, liked, count, onClick };
}
