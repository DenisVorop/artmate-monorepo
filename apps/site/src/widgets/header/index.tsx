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
      data-site-area="header"
      className={cn(
        "sticky top-0 z-11 border-b border-stone-200 bg-white",
        hasDevelopmentBanner
          ? "h-[calc(var(--site-header-banner-height)+var(--site-header-nav-height)+1px)]"
          : "h-[var(--site-header-nav-height)]",
      )}
    >
      {hasDevelopmentBanner ? <DevelopmentBanner /> : null}
      <div className="container flex h-(--site-header-nav-height) w-full max-w-[96rem] items-center gap-[clamp(0.5rem,2.2vw,2rem)]">
        <Logo />
        <CatalogButton />

        <nav className="hidden min-w-0 flex-1 lg:block" aria-label="Основная навигация">
          <Menu />
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-[clamp(0.125rem,0.55vw,0.5rem)]">
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
