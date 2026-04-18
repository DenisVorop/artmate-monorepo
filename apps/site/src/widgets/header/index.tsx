"use client";

import { Logo } from "./ui/logo";
import { CartButton } from "./ui/cart-button";
import { Menu } from "./ui/menu";

export function Header() {
  return (
    <header className="sticky top-0 z-10 bg-white py-4 backdrop-blur-md">
      <div className="container flex items-center justify-between">
        <Logo />

        <Menu />

        <CartButton />
      </div>
    </header>
  );
}
