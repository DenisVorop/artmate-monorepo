"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowUpRight, MenuIcon, X } from "lucide-react";

import { SessionLinks } from "@/features/auth";
import { cn } from "@/shared/lib/utils";
import {
  Button,
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/shared/ui";
import { Link } from "@/shared/ui/link";

import { helpNavItems, isRouteActive, mainNavItems } from "../lib/navigation";
import { Logo } from "./logo";

export function MobileMenu() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setIsOpen(false);
    };

    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          aria-label="Открыть меню"
          className="size-11 rounded-full text-stone-900 hover:bg-stone-100 aria-expanded:bg-transparent lg:hidden"
        >
          <MenuIcon aria-hidden="true" className="size-5" strokeWidth={1.5} />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        showCloseButton={false}
        aria-describedby={undefined}
        className="gap-0 border-l-0 bg-white px-7 text-stone-900 shadow-2xl shadow-stone-900/10 duration-300 data-[side=right]:h-dvh data-[side=right]:w-[88vw] motion-reduce:animate-none motion-reduce:duration-0 max-[360px]:data-[side=right]:w-full data-[side=right]:data-open:slide-in-from-right-full data-[side=right]:data-closed:slide-out-to-right-full"
      >
        <SheetHeader className="shrink-0 flex-row items-center justify-between border-b border-stone-100 px-0 py-4">
          <SheetTitle className="sr-only">Меню Artmate</SheetTitle>
          <Logo onClick={() => setIsOpen(false)} />
          <SheetClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              className="-mr-2 size-11 rounded-full text-stone-500 hover:bg-stone-100 hover:text-stone-900"
              aria-label="Закрыть меню"
            >
              <X aria-hidden="true" className="size-5" strokeWidth={1.5} />
            </Button>
          </SheetClose>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto py-6">
          <nav aria-label="Основные разделы">
            <ul>
              {mainNavItems.map((item) => {
                const isActive = isRouteActive(pathname, item.href);

                return (
                  <li key={item.href} className="border-b border-stone-100 last:border-b-0">
                    <SheetClose asChild>
                      <Link
                        href={item.href}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "group flex min-h-16 items-center justify-between gap-3 py-3 text-2xl font-medium tracking-tight hover:text-rose-600 focus-visible:ring-2 focus-visible:ring-stone-300",
                          isActive ? "text-rose-600" : "text-stone-900",
                        )}
                      >
                        {item.title}
                        <ArrowUpRight
                          aria-hidden="true"
                          strokeWidth={1.5}
                          className={cn(
                            "size-5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none",
                            isActive ? "text-rose-600" : "text-stone-300",
                          )}
                        />
                      </Link>
                    </SheetClose>
                  </li>
                );
              })}
            </ul>
          </nav>

          <nav aria-label="Помощь" className="mt-8">
            <p className="mb-3 text-[11px] font-medium tracking-[0.16em] text-stone-500 uppercase">
              Помощь
            </p>
            <ul>
              {helpNavItems.map((item) => {
                const isActive = isRouteActive(pathname, item.href);

                return (
                  <li key={item.href}>
                    <SheetClose asChild>
                      <Link
                        href={item.href}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "flex min-h-11 items-center text-sm font-medium hover:text-rose-600 focus-visible:ring-2 focus-visible:ring-stone-300",
                          isActive ? "text-rose-600" : "text-stone-500",
                        )}
                      >
                        {item.title}
                      </Link>
                    </SheetClose>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        <SheetFooter className="shrink-0 border-t border-stone-100 px-0 pt-5 pb-[max(1.75rem,env(safe-area-inset-bottom))]">
          <SessionLinks onNavigate={() => setIsOpen(false)} />
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
