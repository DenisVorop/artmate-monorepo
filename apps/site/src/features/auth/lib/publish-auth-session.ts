import type { QueryClient } from "@tanstack/react-query";

import { emailSubscriptionQuery } from "@/entities/email-subscription";
import { achievementQuery } from "@/entities/achievement";
import { loyaltyQuery } from "@/entities/loyalty";
import { ordersQuery } from "@/entities/orders";
import { sessionQuery, type AuthUser } from "@/entities/session";
import { workshopQuery } from "@/entities/workshop";
import {
  cartPricingQueryKey,
  featureBannersQueryKey,
  welcomeOfferQueryKey,
  likesQueryKey,
} from "@/shared/lib/query-keys";

/** Replace identity-derived reads while preserving the cart, promo draft and caller form. */
export async function publishAuthSession(
  queryClient: QueryClient,
  user: AuthUser,
): Promise<void> {
  const personalizedQueryKeys = [
    emailSubscriptionQuery.baseKey,
    achievementQuery.baseKey,
    loyaltyQuery.baseKey,
    ordersQuery.baseKey,
    workshopQuery.baseKey,
    featureBannersQueryKey,
    welcomeOfferQueryKey,
    likesQueryKey,
  ];
  await Promise.all([
    queryClient.cancelQueries({ queryKey: sessionQuery.baseKey }),
    ...personalizedQueryKeys.map((queryKey) =>
      queryClient.cancelQueries({ queryKey }),
    ),
  ]);
  for (const queryKey of personalizedQueryKeys)
    queryClient.removeQueries({ queryKey });
  queryClient.setQueryData(sessionQuery.getSession().queryKey, { user });
  void queryClient.invalidateQueries({ queryKey: cartPricingQueryKey });
}
