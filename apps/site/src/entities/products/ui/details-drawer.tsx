"use client";

import type { ReactNode } from "react";
import { ChevronRight, X } from "lucide-react";

import {
  Button,
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerBody,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/shared/ui";

type DetailsDrawerProps = {
  title: string;
  productTitle: string;
  triggerLabel: string;
  children: ReactNode;
};

export function DetailsDrawer({ title, productTitle, triggerLabel, children }: DetailsDrawerProps) {
  return (
    // eslint-disable-next-line jsx-a11y/no-autofocus -- Focus the modal only after the user opens it.
    <Drawer autoFocus>
      <DrawerTrigger asChild>
        <Button type="button" variant="outline" className="mt-4 h-11 w-full">
          {triggerLabel}
          <ChevronRight aria-hidden="true" />
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="relative shrink-0 border-b pr-16 group-data-[vaul-drawer-direction=bottom]/drawer-content:text-left">
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription className="wrap-anywhere">{productTitle}</DrawerDescription>
          <DrawerClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 size-11"
              aria-label={`Закрыть ${title.toLowerCase()}`}
            >
              <X aria-hidden="true" />
            </Button>
          </DrawerClose>
        </DrawerHeader>
        <DrawerBody className="pt-0">{children}</DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
