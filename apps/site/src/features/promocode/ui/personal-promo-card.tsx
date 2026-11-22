"use client";
import { useId } from "react";
import { Info, LoaderCircle } from "lucide-react";
import { Switch } from "@/shared/ui/switch";
import { Button, Label } from "@/shared/ui";
import { cn } from "@/shared/lib/utils";
import { useAnalytics } from "../lib/analytics";
import { usePromocode } from "../lib/promo-code-provider";
import { getPromoPricingState } from "../lib/promo-pricing-state";
import {
  personalPromoAvailability,
  personalPromoDiscount,
  personalPromoShortDate,
  type PersonalPromoCode,
} from "../lib/personal-promocodes";

export function PersonalPromoCard({
  code,
  compact = false,
  onInfo,
}: {
  code: PersonalPromoCode;
  compact?: boolean;
  onInfo: () => void;
}) {
  const promo = usePromocode(),
    analytics = useAnalytics();
  const controlId = useId();
  const pricing = getPromoPricingState(promo);
  const { canApply } = personalPromoAvailability(code, promo.subtotal);
  const applied = pricing.code === code.code;
  const pending = promo.selectedCode === code.code && !pricing.isReady;
  const discount = personalPromoDiscount(code);
  const disabled =
    (!canApply && !applied) || promo.isHydrating || (promo.isPending && !promo.isPaused);
  return (
    <div className="min-w-0 pt-2">
      <div
        className={cn(
          "relative rounded-2xl bg-stone-100/80",
          compact ? "p-2" : "p-3",
          applied && "bg-rose-50 ring-1 ring-rose-200",
        )}
      >
        {code.endsAt && (
          <span className="pointer-events-none absolute -top-2 right-3 rounded-full bg-white px-2 py-0.5 text-[10px] leading-4 font-medium text-stone-600 shadow-sm">
            До {personalPromoShortDate(code.endsAt)}
          </span>
        )}
        <div className="flex min-h-11 items-center gap-1">
          <Label
            htmlFor={controlId}
            className="relative flex size-11 shrink-0 items-center justify-center"
          >
            <Switch
              id={controlId}
              checked={applied}
              disabled={disabled}
              aria-label={`Применить скидку ${discount} — ${code.title}`}
              className={cn("data-checked:bg-rose-600", pending && "opacity-0")}
              onCheckedChange={(checked) => {
                if (checked) {
                  if (promo.selectedCode && promo.selectedCode !== code.code) analytics.replaced();
                  else analytics.submitted();
                  void promo.applyCode(code.code);
                } else {
                  analytics.removed();
                  promo.clearCode();
                }
              }}
            />
            {pending && (
              <LoaderCircle
                aria-label="Проверяем промокод"
                className="pointer-events-none absolute size-5 animate-spin text-rose-600 motion-reduce:animate-none"
              />
            )}
          </Label>
          <p className="min-w-0 flex-1 text-sm leading-5 font-semibold">Скидка {discount}</p>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-11 shrink-0 rounded-full text-stone-500"
            aria-label={`Условия скидки ${discount} — ${code.title}`}
            onClick={onInfo}
          >
            <Info aria-hidden="true" className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
