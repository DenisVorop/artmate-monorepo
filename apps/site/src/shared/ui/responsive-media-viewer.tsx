"use client";

import { X } from "lucide-react";
import type { ComponentProps, ReactNode, RefObject } from "react";

import { useIsMobile } from "@/shared/lib/device";

import { Button } from "./button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "./dialog";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerTitle } from "./drawer";

type ResponsiveMediaViewerProps = {
  children: ReactNode;
  description: string;
  onOpenChange: (_open: boolean) => void;
  open: boolean;
  returnFocusRef?: RefObject<HTMLElement | null>;
  title: string;
  toolbar?: ReactNode;
};

type MediaViewerChromeProps = {
  closeControl: ReactNode;
  toolbar?: ReactNode;
};

const drawerModalProps = {
  autoFocus: true,
  handleOnly: true,
} as const;

function MediaViewerChrome({ closeControl, toolbar }: MediaViewerChromeProps) {
  return (
    <div className="flex h-14 shrink-0 items-center gap-3 border-b border-rose-100 bg-gradient-to-r from-rose-50/90 via-white to-orange-50/80 px-4 text-stone-900 sm:px-5">
      <div className="min-w-0 flex-1">{toolbar}</div>
      {closeControl}
    </div>
  );
}

function CloseButton(props: ComponentProps<typeof Button>) {
  return (
    <Button
      {...props}
      type="button"
      variant="ghost"
      size="icon-lg"
      aria-label="Закрыть просмотр"
      className="relative shrink-0 border border-stone-200 bg-white text-stone-600 shadow-sm after:absolute after:-inset-1 after:content-[''] hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 focus-visible:border-rose-300 focus-visible:ring-rose-400/40"
    >
      <X aria-hidden="true" />
    </Button>
  );
}

export function ResponsiveMediaViewer({
  children,
  description,
  onOpenChange,
  open,
  returnFocusRef,
  title,
  toolbar,
}: ResponsiveMediaViewerProps) {
  const isMobile = useIsMobile();
  const handleCloseAutoFocus = (event: Event) => {
    if (!returnFocusRef?.current) {
      return;
    }

    event.preventDefault();
    returnFocusRef.current.focus({ preventScroll: true });
  };

  if (isMobile) {
    return (
      <Drawer {...drawerModalProps} open={open} onOpenChange={onOpenChange} direction="bottom">
        <DrawerContent
          data-responsive-media-viewer="drawer"
          onCloseAutoFocus={handleCloseAutoFocus}
          className="h-[calc(100dvh-0.5rem)] max-h-[calc(100dvh-0.5rem)] gap-0 overflow-hidden border-rose-100 bg-white p-0 text-stone-900 shadow-2xl shadow-stone-950/20 data-[vaul-drawer-direction=bottom]:max-h-[calc(100dvh-0.5rem)] [&_[data-slot=drawer-handle]]:mt-2 [&_[data-slot=drawer-handle]]:w-12 [&_[data-slot=drawer-handle]]:bg-rose-300"
        >
          <DrawerTitle className="sr-only">{title}</DrawerTitle>
          <DrawerDescription className="sr-only">{description}</DrawerDescription>
          <MediaViewerChrome
            toolbar={toolbar}
            closeControl={
              <DrawerClose asChild>
                <CloseButton />
              </DrawerClose>
            }
          />
          <div className="flex min-h-0 flex-1 flex-col bg-gradient-to-br from-rose-50/50 via-stone-50 to-orange-50/50">
            {children}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-responsive-media-viewer="dialog"
        onCloseAutoFocus={handleCloseAutoFocus}
        showCloseButton={false}
        className="flex h-[min(92dvh,64rem)] max-w-[min(94vw,80rem)] flex-col gap-0 overflow-hidden border-rose-100 bg-white p-0 text-stone-900 shadow-2xl shadow-stone-950/20 ring-stone-900/10 sm:max-w-[min(94vw,80rem)]"
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{description}</DialogDescription>
        <MediaViewerChrome
          toolbar={toolbar}
          closeControl={
            <DialogClose asChild>
              <CloseButton />
            </DialogClose>
          }
        />
        <div className="flex min-h-0 flex-1 flex-col bg-gradient-to-br from-rose-50/50 via-stone-50 to-orange-50/50">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
