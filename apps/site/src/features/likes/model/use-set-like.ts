"use client";

import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { likesQuery, likeStateSchema, type LikeSubject, type LikeState } from "@/entities/likes";
import { sessionQuery, type AuthSession } from "@/entities/session";
import { setLike } from "@/shared/actions/likes";
import { ApiResult } from "@/shared/lib/api-result";

type Input = { actorId: string; liked: boolean };

export function useSetLike(subject: LikeSubject) {
  const client = useQueryClient();
  const mutationKey = [...likesQuery.baseKey, "mutation", subject.subjectType, subject.subjectId];
  const pending = useIsMutating({ mutationKey, exact: true }) > 0;
  const sameActor = (actorId: string) =>
    client.getQueryData<AuthSession>(sessionQuery.getSession().queryKey)?.user?.id === actorId;
  const { mutateAsync } = useMutation({
    mutationKey,
    mutationFn: async ({ actorId, liked }: Input) => {
      if (!sameActor(actorId)) throw new Error("Like account changed");
      return likeStateSchema.parse(
        ApiResult.fromDTO(await setLike(subject, liked, actorId)).unwrap(),
      );
    },
    onMutate: async ({ actorId, liked }) => {
      const queryKey = likesQuery.state(subject, actorId).queryKey;
      await client.cancelQueries({ queryKey, exact: true });
      const previous = client.getQueryData(queryKey);
      if (previous && sameActor(actorId)) {
        const optimistic: LikeState = {
          ...previous,
          viewerHasLiked: liked,
          count: Math.max(0, previous.count + Number(liked) - Number(previous.viewerHasLiked)),
        };
        client.setQueryData(queryKey, optimistic);
      }
      return { queryKey, previous };
    },
    onSuccess: (state, { actorId }, context) => {
      if (context && sameActor(actorId)) client.setQueryData(context.queryKey, state);
    },
    onError: async (error, { actorId }, context) => {
      if (!context || !sameActor(actorId)) return;
      if (context.previous) client.setQueryData(context.queryKey, context.previous);
      const status = "status" in error ? error.status : undefined;
      if (status === 401 || status === 409)
        await client.invalidateQueries({ queryKey: sessionQuery.baseKey });
      // A lost response may have followed a committed write. Always reconcile;
      // an unsuccessful read leaves the control in its explicit retry state.
      await client.invalidateQueries({ queryKey: context.queryKey, exact: true });
      toast.error(
        status === 401
          ? "Войдите ещё раз, чтобы поставить лайк."
          : status === 409
            ? "Аккаунт изменился. Попробуйте ещё раз."
            : status === 429
              ? "Слишком много нажатий. Попробуйте через минуту."
              : status === 404
                ? "Эта работа больше недоступна."
                : "Не удалось обновить лайк. Проверьте соединение и попробуйте ещё раз.",
      );
    },
  });

  return {
    isPending: pending,
    mutate: (input: Input) =>
      client.isMutating({ mutationKey, exact: true })
        ? Promise.resolve(undefined)
        : mutateAsync(input),
  };
}
