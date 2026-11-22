"use client";
import { useEffect, useId } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronRight, TicketPercent, Trash2 } from "lucide-react";
import { Button } from "@/shared/ui";
import { useUser } from "@/entities/session";
import { useAnalytics } from "../lib/analytics";
import { usePromocode } from "../lib/promo-code-provider";
import { getPromoPricingState } from "../lib/promo-pricing-state";
import { promoCodeFormSchema, type PromoCodeFormValues } from "../lib/promo-code-form";
import { personalPromoCount } from "../lib/personal-promocodes";
import type { PersonalPromoCode } from "../lib/personal-promocodes";
import { usePromoPickerState } from "../lib/use-promo-picker-state";
import { usePersonalPromocodes } from "../model/use-personal-promocodes";
import { PersonalPromoCodes } from "./personal-promo-codes";
import { PromoCodePicker } from "./promo-code-picker";
import { PromoCodeStatus } from "./promo-code-status";

export function PromoCodeForm() {
  const user = useUser();
  return <PromoCodeControls key={user?.id ?? "guest"} />;
}
function PromoCodeControls() {
  const promo = usePromocode(),
    analytics = useAnalytics();
  const pricing = getPromoPricingState(promo);
  const personal = usePersonalPromocodes();
  const picker = usePromoPickerState();
  const selectedPersonal = personal.codes.some((code) => code.code === promo.selectedCode);
  const headingId = useId();
  const form = useForm<PromoCodeFormValues>({
    defaultValues: { code: promo.selectedCode ?? "" },
    resolver: zodResolver(promoCodeFormSchema),
  });
  useEffect(() => {
    form.reset({ code: promo.selectedCode ?? "" });
  }, [form, promo.selectedCode]);
  function show(view: "list" | "manual") {
    analytics.opened();
    picker.show(view);
  }
  function close() {
    analytics.closed();
    picker.close();
  }
  function showDetails(code: PersonalPromoCode, fromList = false) {
    if (!picker.open) analytics.opened();
    picker.showDetails(code, fromList);
  }
  return (
    <section aria-labelledby={headingId} className="min-w-0 space-y-2 py-3">
      <h3 id={headingId} className="text-base font-semibold">
        Промокоды
      </h3>
      <Button
        type="button"
        variant="ghost"
        className="h-auto min-h-12 w-full justify-between gap-3 px-3 text-left whitespace-normal"
        onClick={() => show(personal.codes.length ? "list" : "manual")}
      >
        <TicketPercent aria-hidden="true" className="size-5 shrink-0 text-stone-500" />
        <span className="flex-1">
          {personal.codes.length
            ? `У вас ${personalPromoCount(personal.codes.length)}`
            : "Ввести промокод"}
        </span>
        <ChevronRight aria-hidden="true" className="size-4 shrink-0" />
      </Button>
      {personal.codes.length > 0 && (
        <PersonalPromoCodes codes={personal.codes} onInfo={showDetails} />
      )}
      {personal.isPending && !personal.codes.length && personal.owner && (
        <p role="status" className="text-xs text-stone-500">
          Загружаем личные промокоды…
        </p>
      )}
      {personal.isError && !personal.codes.length && (
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 px-0 text-xs"
          onClick={() => void personal.retry()}
        >
          Загрузить личные промокоды ещё раз
        </Button>
      )}
      {promo.selectedCode && (!selectedPersonal || promo.isError || promo.isPaused) && (
        <div className="flex min-w-0 items-center gap-2 border-t pt-2">
          {pricing.code && (
            <Check aria-label="Промокод применён" className="size-4 shrink-0 text-rose-600" />
          )}
          <Button
            type="button"
            variant="ghost"
            className="h-auto min-h-11 min-w-0 flex-1 justify-start px-0 text-left text-xs break-all whitespace-normal"
            aria-label="Изменить промокод"
            onClick={() => {
              analytics.edited();
              show("manual");
            }}
          >
            {promo.selectedCode}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11 text-stone-500"
            aria-label="Убрать промокод"
            onClick={() => {
              analytics.removed();
              promo.clearCode();
            }}
          >
            <Trash2 aria-hidden="true" className="size-4" />
          </Button>
        </div>
      )}
      <PromoCodeStatus
        onLogin={() => {
          close();
          promo.onLoginRequested?.();
        }}
      />
      <PromoCodePicker
        open={picker.open}
        onOpenChange={(value) => {
          if (!value) close();
          else picker.setOpen(true);
        }}
        view={picker.view}
        onViewChange={picker.setView}
        codes={personal.codes}
        form={form}
        details={picker.details}
        detailsFromList={picker.detailsFromList}
        onInfo={(code) => showDetails(code, true)}
      />
    </section>
  );
}
