"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  emailSubscriptionQuery,
  emailSubscriptionSchema,
  type EmailSubscription,
} from "@/entities/email-subscription";
import { sessionQuery, type AuthSession } from "@/entities/session";
import { grantEmailSubscription } from "@/shared/actions/consents";
import { ApiResult } from "@/shared/lib/api-result";

interface GrantSubscriptionInput {
  readonly ownerId: string;
  readonly revisionId: string;
  readonly expectedVersion: number;
  readonly expectedStateRevision: number;
}

export function useGrantSubscription() {
  const queryClient = useQueryClient();
  const { mutateAsync, isPending } = useMutation({
    mutationFn: async ({
      ownerId,
      revisionId,
      expectedVersion,
      expectedStateRevision,
    }: GrantSubscriptionInput) => {
      const result = ApiResult.fromDTO(
        await grantEmailSubscription(ownerId, {
          revisionId,
          expectedVersion,
          expectedStateRevision,
        }),
      ).unwrap();
      const state = emailSubscriptionSchema.parse(result);
      if (!state.subscribed) throw new Error("Subscription grant was not acknowledged");
      return state;
    },
    onMutate: async ({ ownerId }: GrantSubscriptionInput) => {
      await queryClient.cancelQueries({
        queryKey: emailSubscriptionQuery.status(ownerId).queryKey,
        exact: true,
      });
    },
    onSuccess: async (state: EmailSubscription, input: GrantSubscriptionInput) => {
      const ownerId = input.ownerId;
      const key = emailSubscriptionQuery.status(ownerId).queryKey;
      await queryClient.cancelQueries({ queryKey: key, exact: true });
      const session = queryClient.getQueryData<AuthSession>(sessionQuery.getSession().queryKey);
      if (session?.user?.id !== ownerId) return;
      queryClient.setQueryData<EmailSubscription>(key, (previous) =>
        previous &&
        (previous.version > state.version ||
          (previous.version === state.version && previous.stateRevision > state.stateRevision))
          ? previous
          : state,
      );
    },
  });
  return { grant: mutateAsync, isPending };
}
