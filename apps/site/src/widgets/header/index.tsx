"use client";

import { SessionMenu } from "@/features/auth";

import { Logo } from "./ui/logo";
import { CartButton } from "./ui/cart-button";
import { Menu } from "./ui/menu";

export function Header() {
  return (
    <header className="sticky top-0 z-11 border-b-[1px] border-stone-200 bg-white py-4 backdrop-blur-md">
      <div className="container flex items-center justify-between">
        <Logo />

        <Menu />

        <div className="flex items-center gap-2">
          <SessionMenu />
          <CartButton />
        </div>
      </div>
    </header>
  );
}
