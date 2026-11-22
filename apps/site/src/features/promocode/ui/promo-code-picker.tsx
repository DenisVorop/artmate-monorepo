"use client";
import type { UseFormReturn } from "react-hook-form";
import { ArrowLeft, ChevronRight, X } from "lucide-react";
import {
  Button,
  CtaGradientButton,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Drawer,
  DrawerContent,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/shared/ui";
import { useIsMobile } from "@/shared/lib/device";
import type { PromoCodeFormValues } from "../lib/promo-code-form";
import type { PersonalPromoCode } from "../lib/personal-promocodes";
import { usePromocode } from "../lib/promo-code-provider";
import { PersonalPromoCard } from "./personal-promo-card";
import { ManualPromoCodeForm } from "./manual-promo-code-form";
import { PromoCodeStatus } from "./promo-code-status";
import { PromoCodeConditions } from "./promo-code-conditions";
import type { PromoPickerView } from "../lib/use-promo-picker-state";

type Props = {
  open: boolean;
  onOpenChange: (_open: boolean) => void;
  view: PromoPickerView;
  onViewChange: (_view: PromoPickerView) => void;
  codes: readonly PersonalPromoCode[];
  form: UseFormReturn<PromoCodeFormValues>;
  details: PersonalPromoCode | null;
  detailsFromList: boolean;
  onInfo: (_code: PersonalPromoCode) => void;
};
export function PromoCodePicker({
  open,
  onOpenChange,
  view,
  onViewChange,
  codes,
  form,
  details,
  detailsFromList,
  onInfo,
}: Props) {
  const mobile = useIsMobile(),
    promo = usePromocode();
  const close = () => onOpenChange(false);
  const title =
    view === "details" ? "Условия промокода" : view === "list" ? "Промокоды" : "Промокод";
  const controls = ((view === "manual" && codes.length > 0) ||
    (view === "details" && detailsFromList)) && (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-11 shrink-0"
      aria-label="Назад к промокодам"
      onClick={() => onViewChange("list")}
    >
      <ArrowLeft aria-hidden="true" className="size-5" />
    </Button>
  );
  const body =
    view === "manual" ? (
      <ManualPromoCodeForm form={form} onClose={close} />
    ) : (
      <DrawerBody className="px-5 py-4">
        {view === "details" && details ? (
          <PromoCodeConditions code={details} />
        ) : (
          <div className="space-y-4">
            {codes.map((code) => (
              <PersonalPromoCard key={code.id} code={code} onInfo={() => onInfo(code)} />
            ))}
            <PromoCodeStatus
              onLogin={() => {
                close();
                promo.onLoginRequested?.();
              }}
            />
          </div>
        )}
      </DrawerBody>
    );
  const footer =
    view === "details" ? (
      <DrawerFooter className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <CtaGradientButton
          type="button"
          className="min-h-12 w-full"
          onClick={() => (detailsFromList ? onViewChange("list") : close())}
        >
          Понятно
        </CtaGradientButton>
      </DrawerFooter>
    ) : (
      view === "list" && (
        <DrawerFooter className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <Button
            type="button"
            variant="ghost"
            className="min-h-12 w-full justify-between px-3"
            onClick={() => onViewChange("manual")}
          >
            Ввести промокод
            <ChevronRight aria-hidden="true" className="size-4" />
          </Button>
          <CtaGradientButton type="button" className="min-h-12 w-full" onClick={close}>
            Готово
          </CtaGradientButton>
        </DrawerFooter>
      )
    );
  if (mobile)
    return (
      <Drawer open={open} onOpenChange={onOpenChange} handleOnly>
        <DrawerContent data-promo-picker="drawer" className="gap-0">
          <DrawerHeader className="flex shrink-0 flex-row items-center gap-2 border-b px-5 py-3 text-left">
            {controls}
            <div className="min-w-0 flex-1">
              <DrawerTitle className="font-heading text-xl font-bold">{title}</DrawerTitle>
              <DrawerDescription className="sr-only">
                Выбор личного промокода или ввод кода
              </DrawerDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11"
              aria-label="Закрыть промокоды"
              onClick={close}
            >
              <X aria-hidden="true" className="size-5" />
            </Button>
          </DrawerHeader>
          {body}
          {footer}
        </DrawerContent>
      </Drawer>
    );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-promo-picker="dialog"
        showCloseButton={false}
        className="flex max-h-[85dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
      >
        <DialogHeader className="flex shrink-0 flex-row items-center gap-2 border-b px-5 py-3 text-left">
          {controls}
          <div className="min-w-0 flex-1">
            <DialogTitle className="font-heading text-xl font-bold">{title}</DialogTitle>
            <DialogDescription className="sr-only">
              Выбор личного промокода или ввод кода
            </DialogDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11"
            aria-label="Закрыть промокоды"
            onClick={close}
          >
            <X aria-hidden="true" className="size-5" />
          </Button>
        </DialogHeader>
        {body}
        {footer}
      </DialogContent>
    </Dialog>
  );
}
