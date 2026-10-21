"use client";

import { useEffect, useRef, useSyncExternalStore, type RefObject } from "react";
import { usePathname } from "next/navigation";

import { routes } from "@/shared/constants";
import { Dialog, DialogContent, DialogTitle } from "@/shared/ui/dialog";

import type { AuthFlowCoordinator } from "../lib/auth-flow-coordinator";
import { CurrentFlowView } from "./current-flow-view";

/** Only forms opened over the site use a portal; auth routes render their own surface. */
export function AuthHost({
  coordinator,
  returnFocus,
}: {
  coordinator: AuthFlowCoordinator;
  returnFocus: RefObject<HTMLElement | null>;
}) {
  const pathname = usePathname();
  const isAuthRoute = pathname === routes.auth || pathname.startsWith(`${routes.auth}/`);
  const snapshot = useSyncExternalStore(
    coordinator.subscribe,
    coordinator.getSnapshot,
    coordinator.getSnapshot,
  );
  const contentRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (snapshot.visible) contentRef.current?.scrollTo({ top: 0 });
  }, [snapshot.step, snapshot.visible]);

  if (isAuthRoute) return null;

  return (
    <Dialog
      open={snapshot.visible}
      onOpenChange={(open) => {
        if (!open) void coordinator.cancel();
      }}
    >
      <DialogContent
        ref={contentRef}
        showCloseButton={false}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (returnFocus.current?.isConnected) returnFocus.current.focus();
        }}
        aria-describedby={undefined}
        className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-177 overflow-y-auto rounded-[22px] bg-transparent p-0 ring-0 sm:max-w-177"
      >
        <DialogTitle className="sr-only">Вход в Artmate</DialogTitle>
        <CurrentFlowView snapshot={snapshot} coordinator={coordinator} dismissible />
      </DialogContent>
    </Dialog>
  );
}
