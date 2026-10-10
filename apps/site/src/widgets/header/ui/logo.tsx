"use client";

import { routes } from "@/shared/constants";
import { Link } from "@/shared/ui/link";

import LogoSvg from "../assets/logo.svg";
export function Logo({ onClick }: { onClick?: () => void }) {
  return (
    <Link
      href={routes.home}
      onClick={onClick}
      aria-label="Artmate — на главную"
      className="inline-flex shrink-0 items-center rounded-md focus-visible:ring-2 focus-visible:ring-rose-300"
    >
      <LogoSvg aria-hidden="true" viewBox="0 0 123 58" className="h-auto w-23 lg:w-27" />
    </Link>
  );
}
