"use client";
import { useUser } from "@/entities/session";
import { usePrizes } from "@/entities/prize";
import { useWelcomePromo } from "@/entities/promocode";
import { getPersonalPromoCodes } from "../lib/personal-promocodes";

export function usePersonalPromocodes() {
  const user = useUser();
  const owner = user?.id ?? "";
  const prizes = usePrizes(owner);
  const welcome = useWelcomePromo({ userId: owner, enabled: Boolean(owner) });
  return {
    owner,
    codes: owner ? getPersonalPromoCodes(prizes.data?.available ?? [], welcome.data?.promo) : [],
    isPending: Boolean(owner) && (prizes.isPending || welcome.isPending),
    isError: Boolean(owner) && (prizes.isError || welcome.isError),
    retry: () => Promise.allSettled([prizes.refetch(), welcome.refetch()]),
  };
}
