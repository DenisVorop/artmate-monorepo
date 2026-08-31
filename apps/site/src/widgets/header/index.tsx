"use client";

import { useDevelopmentBanner } from "@/entities/feature-banners";
import { useSession } from "@/entities/session";
import { SessionMenu } from "@/features/auth";
import { getQueryOwner } from "@/shared/lib/query-keys";
import { cn } from "@/shared/lib/utils";

import { Logo } from "./ui/logo";
import { CartButton } from "./ui/cart-button";
import { DevelopmentBanner } from "./ui/development-banner";
import { Menu, MobileMenu } from "./ui/menu";

export function Header() {
  const { isPending, user } = useSession();
  const { hasDevelopmentBanner } = useDevelopmentBanner({
    enabled: !isPending,
    owner: getQueryOwner(user?.id),
  });

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
          className="hidden min-w-0 flex-1 lg:ml-3 lg:block xl:ml-8"
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
