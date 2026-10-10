"use client";

import { usePathname } from "next/navigation";

import { routes } from "@/shared/constants";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui";
import { Link } from "@/shared/ui/link";

import { isRouteActive } from "../lib/navigation";

export function CatalogButton({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <Button
      asChild
      variant="secondary"
      className={cn(
        "h-11 rounded-full bg-stone-900 px-4 text-sm font-medium text-white hover:bg-stone-700 hover:text-white focus-visible:text-white focus-visible:ring-stone-400 lg:px-5",
        className,
      )}
    >
      <Link
        href={routes.catalog}
        aria-current={isRouteActive(pathname, routes.catalog) ? "page" : undefined}
      >
        Каталог
      </Link>
    </Button>
  );
}
