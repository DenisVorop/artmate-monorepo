"use client";

import { LoaderCircle, X } from "lucide-react";
import { useEffect, useRef } from "react";

import { useDeviceInfo } from "@/shared/lib/device";
import {
  Button,
  CtaGradientButton,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerBody,
  DrawerDescription,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
} from "@/shared/ui";

import type { DeliveryPickerDrafts } from "../lib";

import { DeliverySelector } from "./delivery-selector";
import type { DeliveryCompanyCode } from "./delivery-selector/delivery-options";

type DeliveryPickerProps = {
  confirmationError?: string;
  drafts: DeliveryPickerDrafts;
  isConfirming: boolean;
  isOzonDeliveryAvailable: boolean;
  isOpen: boolean;
  onCompanyChange: (_company: DeliveryCompanyCode) => void;
  onConfirm: () => void;
  onDraftChange: (_update: (_drafts: DeliveryPickerDrafts) => DeliveryPickerDrafts) => void;
  onOpenChange: (_isOpen: boolean) => void;
  selectedCompany: DeliveryCompanyCode;
  canConfirm: boolean;
};

export function DeliveryPicker({
  canConfirm,
  confirmationError,
  drafts,
  isConfirming,
  isOzonDeliveryAvailable,
  isOpen,
  onCompanyChange,
  onConfirm,
  onDraftChange,
  onOpenChange,
  selectedCompany,
}: DeliveryPickerProps) {
  const { isDesktop } = useDeviceInfo();
  const confirmLockRef = useRef(false);

  useEffect(() => {
    if (!isConfirming) confirmLockRef.current = false;
  }, [isConfirming]);

  function handleConfirm() {
    if (!canConfirm || isConfirming || confirmLockRef.current) return;
    confirmLockRef.current = true;
    onConfirm();
  }

  const selector = (
    <DeliverySelector
      drafts={drafts}
      isOzonDeliveryAvailable={isOzonDeliveryAvailable}
      selectedCompany={selectedCompany}
      onCompanyChange={onCompanyChange}
      onDraftChange={onDraftChange}
    />
  );
  const footer = (
    <>
      {confirmationError ? (
        <p className="text-sm text-destructive" role="alert">
          {confirmationError}
        </p>
      ) : null}
      <CtaGradientButton
        type="button"
        className="min-h-11 w-full"
        disabled={!canConfirm || isConfirming}
        onClick={handleConfirm}
      >
        {isConfirming ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : null}
        {isConfirming ? "Подтверждаем ПВЗ" : "Подтвердить ПВЗ"}
      </CtaGradientButton>
    </>
  );

  if (isDesktop) {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="flex h-[min(90dvh,48rem)] flex-col overflow-hidden sm:max-w-[min(94vw,72rem)]">
          <DialogHeader className="shrink-0">
            <DialogTitle>Выберите пункт выдачи</DialogTitle>
            <DialogDescription>Найдите удобный ПВЗ в списке или на карте.</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{selector}</div>
          <div className="shrink-0 space-y-3">{footer}</div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="relative shrink-0 pr-16 text-left">
          <DrawerTitle>Выберите пункт выдачи</DrawerTitle>
          <DrawerDescription>Найдите удобный ПВЗ в списке или на карте.</DrawerDescription>
          <DrawerClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-1 right-2 size-11"
            >
              <X aria-hidden="true" />
              <span className="sr-only">Закрыть</span>
            </Button>
          </DrawerClose>
        </DrawerHeader>
        <DrawerBody className="py-0">{selector}</DrawerBody>
        <DrawerFooter className="space-y-3">{footer}</DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
