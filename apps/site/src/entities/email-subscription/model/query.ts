import { queryOptions } from "@tanstack/react-query";

import { getEmailSubscription } from "@/shared/actions/consents";
import { ApiResult } from "@/shared/lib/api-result";
import { emailSubscriptionSchema } from "./types";

export const emailSubscriptionQuery = {
  baseKey: ["email-subscription"] as const,
  status: (ownerId: string) =>
    queryOptions({
      queryKey: ["email-subscription", ownerId, "status"] as const,
      queryFn: async ({ signal }) => {
        const response = await getEmailSubscription(ownerId);
        signal.throwIfAborted();
        return emailSubscriptionSchema.parse(
          ApiResult.fromDTO(response).unwrap(),
        );
      },
      staleTime: 0,
      retry: false,
      retryOnMount: false,
      refetchOnMount: true,
      refetchOnWindowFocus: true,
    }),
};
