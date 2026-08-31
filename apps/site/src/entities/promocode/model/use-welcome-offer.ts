"use client";

import { useQuery } from "@tanstack/react-query";

import { isWelcomeOfferActive } from "../lib/welcome-offer-selectors";
import { promoCodeQuery } from "./query";

type UseWelcomeOfferInput = {
  enabled: boolean;
  owner: string;
};

export function useWelcomeOffer({ enabled, owner }: UseWelcomeOfferInput) {
  const result = useQuery({
    ...promoCodeQuery.welcomeOffer(owner),
    enabled,
  });
  const offer =
    enabled &&
    !result.isError &&
    !result.isPaused &&
    result.fetchStatus !== "paused" &&
    result.data?.offer &&
    isWelcomeOfferActive(result.data.offer)
      ? result.data.offer
      : undefined;

  return {
    data: offer,
    isPending: enabled && result.isPending,
  };
}
