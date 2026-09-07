"use client";

import { LoaderCircle, X } from "lucide-react";
import { useEffect, useRef } from "react";

import { useDeviceInfo } from "@/shared/lib/device";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
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

  const content = (
    <>
      <DeliverySelector
        drafts={drafts}
        isOzonDeliveryAvailable={isOzonDeliveryAvailable}
        selectedCompany={selectedCompany}
        onCompanyChange={onCompanyChange}
        onDraftChange={onDraftChange}
      />
      {confirmationError ? (
        <p className="text-sm text-destructive" role="alert">
          {confirmationError}
        </p>
      ) : null}
      <Button
        type="button"
        className="min-h-11 w-full sm:w-auto"
        disabled={!canConfirm || isConfirming}
        onClick={handleConfirm}
      >
        {isConfirming ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : null}
        {isConfirming ? "Подтверждаем ПВЗ" : "Подтвердить ПВЗ"}
      </Button>
    </>
  );

  if (isDesktop) {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[min(94vw,72rem)]">
          <DialogHeader>
            <DialogTitle>Выберите пункт выдачи</DialogTitle>
            <DialogDescription>Найдите удобный ПВЗ в списке или на карте.</DialogDescription>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92vh] pb-[env(safe-area-inset-bottom)]">
        <DrawerHeader className="relative pr-16 text-left">
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
        <div className="overflow-y-auto px-4 pb-4">{content}</div>
      </DrawerContent>
    </Drawer>
  );
}
