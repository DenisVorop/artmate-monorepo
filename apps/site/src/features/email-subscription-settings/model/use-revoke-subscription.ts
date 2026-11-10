"use client";

import { useAnalytics } from "../lib/analytics";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  emailSubscriptionQuery,
  emailSubscriptionSchema,
  type EmailSubscription,
} from "@/entities/email-subscription";
import { sessionQuery, type AuthSession } from "@/entities/session";
import { revokeEmailSubscription } from "@/shared/actions/consents";
import { ApiResult } from "@/shared/lib/api-result";

export function useRevokeSubscription() {
  const analytics = useAnalytics();
  const queryClient = useQueryClient();
  const { mutateAsync, isPending } = useMutation({
    mutationFn: async (ownerId: string) => {
      const result = ApiResult.fromDTO(await revokeEmailSubscription(ownerId)).unwrap();
      const state = emailSubscriptionSchema.parse(result);
      if (state.subscribed) throw new Error("Subscription revoke was not acknowledged");
      return state;
    },
    onMutate: async (ownerId) => {
      await queryClient.cancelQueries({
        queryKey: emailSubscriptionQuery.status(ownerId).queryKey,
        exact: true,
      });
    },
    onError: () => analytics.revokeFailed(),
    onSuccess: async (state, ownerId) => {
      const key = emailSubscriptionQuery.status(ownerId).queryKey;
      await queryClient.cancelQueries({ queryKey: key, exact: true });
      const session = queryClient.getQueryData<AuthSession>(sessionQuery.getSession().queryKey);
      if (session?.user?.id !== ownerId) return;
      analytics.revoked();
      queryClient.setQueryData<EmailSubscription>(key, (previous) =>
        previous &&
        (previous.version > state.version ||
          (previous.version === state.version && previous.stateRevision > state.stateRevision))
          ? previous
          : state,
      );
    },
  });
  return { revoke: mutateAsync, isPending };
}
