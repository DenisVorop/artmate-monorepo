"use client";

import { useDevelopmentBanner } from "@/entities/feature-banners";
import { SessionMenu } from "@/features/auth";
import { cn } from "@/shared/lib/utils";

import { Logo } from "./ui/logo";
import { CartButton } from "./ui/cart-button";
import { DevelopmentBanner } from "./ui/development-banner";
import { Menu, MobileMenu } from "./ui/menu";

export function Header() {
  const { hasDevelopmentBanner } = useDevelopmentBanner();

  return (
    <header
      className={cn(
        "sticky top-0 z-11 border-b-[1px] border-stone-200 bg-white backdrop-blur-md",
        hasDevelopmentBanner
          ? "h-[calc(var(--site-header-banner-height)+var(--site-header-nav-height)+1px)]"
          : "h-[var(--site-header-nav-height)]",
      )}
    >
      {hasDevelopmentBanner ? <DevelopmentBanner /> : null}
      <div className="container flex h-[var(--site-header-nav-height)] items-center gap-2 sm:gap-3">
        <Logo />

        <nav
          className="hidden shrink-0 lg:ml-6 lg:block lg:w-[30rem] xl:ml-20 xl:w-[31rem]"
          aria-label="Основная навигация"
        >
          <Menu />
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <SessionMenu />
          <CartButton />
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
