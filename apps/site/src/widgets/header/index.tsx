"use client";

import { SessionMenu } from "@/features/auth";

import { Logo } from "./ui/logo";
import { CartButton } from "./ui/cart-button";
import { Menu, MobileMenu } from "./ui/menu";

export function Header() {
  return (
    <header className="sticky top-0 z-11 h-16 border-b-[1px] border-stone-200 bg-white backdrop-blur-md">
      <div className="container flex h-full items-center justify-between gap-3">
        <Logo />

        <nav className="hidden lg:block" aria-label="Основная навигация">
          <Menu />
        </nav>

        <div className="flex items-center gap-2">
          <SessionMenu />
          <CartButton />
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
