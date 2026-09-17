"use client";

import { useEffect, useId, useState } from "react";
import { Info } from "lucide-react";

import {
  Button,
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/ui";

type StatusHintProps = {
  readonly hint: string;
  readonly label: string;
};

type StatusHintSurface = "drawer" | "popover" | null;

export function StatusHint({ hint, label }: StatusHintProps) {
  const descriptionId = useId();
  const headingId = useId();
  const [openSurface, setOpenSurface] = useState<StatusHintSurface>(null);
  const statusTrigger = (
    <Button
      aria-label={`Статус «${label}»: показать пояснение`}
      className="h-auto max-w-full min-w-0 shrink gap-1 rounded-full px-2.5 py-1 text-left text-xs whitespace-normal"
      size="sm"
      type="button"
      variant="outline"
    >
      <span className="min-w-0 break-words">{label}</span>
      <Info className="size-3 shrink-0" aria-hidden="true" />
    </Button>
  );

  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 640px)");
    const closeOnBreakpointChange = () => setOpenSurface(null);

    desktopQuery.addEventListener("change", closeOnBreakpointChange);
    return () =>
      desktopQuery.removeEventListener("change", closeOnBreakpointChange);
  }, []);

  return (
    <>
      <span className="hidden max-w-full sm:inline-flex">
        <Popover
          open={openSurface === "popover"}
          onOpenChange={(open) => setOpenSurface(open ? "popover" : null)}
        >
          <PopoverTrigger asChild>{statusTrigger}</PopoverTrigger>
          <PopoverContent
            align="start"
            aria-describedby={descriptionId}
            aria-labelledby={headingId}
            className="w-[min(18rem,calc(100vw-2rem))] gap-1.5 border-l-2 border-l-violet-500/70 p-3 shadow-lg"
            collisionPadding={16}
            sideOffset={6}
          >
            <p className="text-xs font-bold text-foreground" id={headingId}>
              {label}
            </p>
            <p
              className="text-xs leading-5 text-muted-foreground"
              id={descriptionId}
            >
              {hint}
            </p>
          </PopoverContent>
        </Popover>
      </span>

      <span className="inline-flex max-w-full sm:hidden">
        <Drawer
          autoFocus
          open={openSurface === "drawer"}
          onOpenChange={(open) => setOpenSurface(open ? "drawer" : null)}
        >
          <DrawerTrigger asChild>{statusTrigger}</DrawerTrigger>
          <DrawerContent className="max-h-[min(80dvh,32rem)] overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
            <DrawerHeader className="gap-2 px-5 pt-4 pb-3 text-left">
              <DrawerTitle>{label}</DrawerTitle>
              <DrawerDescription>{hint}</DrawerDescription>
            </DrawerHeader>
            <DrawerFooter className="px-5 pt-1 pb-4">
              <DrawerClose asChild>
                <Button className="w-full" type="button">
                  Понятно
                </Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </span>
    </>
  );
}
