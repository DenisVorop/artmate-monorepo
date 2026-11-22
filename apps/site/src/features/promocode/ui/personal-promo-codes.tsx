"use client";
import { HorizontalRail } from "@/shared/ui/horizontal-rail";
import type { PersonalPromoCode } from "../lib/personal-promocodes";
import { PersonalPromoCard } from "./personal-promo-card";

export function PersonalPromoCodes({
  codes,
  onInfo,
}: {
  codes: readonly PersonalPromoCode[];
  onInfo: (_code: PersonalPromoCode) => void;
}) {
  return (
    <div className="min-w-0">
      <HorizontalRail
        label="Личные промокоды"
        contained
        className="auto-cols-[min(15rem,calc(100%_-_1rem))] gap-3 rounded-xl px-0.5 pt-0.5 pb-3"
      >
        {codes.map((code) => (
          <PersonalPromoCard key={code.id} code={code} compact onInfo={() => onInfo(code)} />
        ))}
      </HorizontalRail>
    </div>
  );
}
