"use client";

import { useDevelopmentBanner } from "@/entities/feature-banners";
import { useSession } from "@/entities/session";
import { SessionMenu } from "@/features/auth";
import { getQueryOwner } from "@/shared/lib/query-keys";
import { cn } from "@/shared/lib/utils";

import { Logo } from "./ui/logo";
import { CartButton } from "./ui/cart-button";
import { CatalogButton } from "./ui/catalog-button";
import { DevelopmentBanner } from "./ui/development-banner";
import { Menu } from "./ui/menu";
import { MobileMenu } from "./ui/mobile-menu";

export function Header() {
  const { isPending, user } = useSession();
  const { hasDevelopmentBanner } = useDevelopmentBanner({
    enabled: !isPending,
    owner: getQueryOwner(user?.id),
  });

  return (
    <header
      className={cn(
        "sticky top-0 z-11 border-b border-stone-100 bg-white",
        hasDevelopmentBanner
          ? "h-[calc(var(--site-header-banner-height)+var(--site-header-nav-height)+1px)]"
          : "h-[var(--site-header-nav-height)]",
      )}
    >
      {hasDevelopmentBanner ? <DevelopmentBanner /> : null}
      <div className="container flex h-[var(--site-header-nav-height)] items-center gap-2 lg:gap-8">
        <Logo />
        <CatalogButton className="ml-auto lg:ml-0" />

        <nav className="hidden min-w-0 flex-1 lg:block" aria-label="Основная навигация">
          <Menu />
        </nav>

        <div className="flex shrink-0 items-center gap-0.5 lg:gap-2">
          <div className="hidden lg:block">
            <SessionMenu />
          </div>
          <CartButton />
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
