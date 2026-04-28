"use client";

import { routes } from "@/shared/constants";
import { useIsMobile } from "@/shared/lib/device";
import { Link } from "@/shared/ui/link";

import LogoSvg from "../assets/logo.svg";
import LogoSquareSvg from "../assets/logo-square.svg";

export function Logo() {
  const isMobile = useIsMobile();

  return (
    <Link href={routes.home} aria-label="Artmate" className="inline-flex shrink-0 items-center">
      {isMobile ? (
        <LogoSquareSvg aria-hidden="true" className="h-9 w-auto sm:h-10" height="36" />
      ) : (
        <LogoSvg aria-hidden="true" className="h-10 w-auto sm:h-12 lg:h-[3.625rem]" height="40" />
      )}
    </Link>
  );
}
