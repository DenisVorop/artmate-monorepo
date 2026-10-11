"use client";

import { usePathname } from "next/navigation";
import { LayoutGrid } from "lucide-react";

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
        "h-11 gap-2 rounded-full border-rose-100 bg-rose-50 px-4 text-sm font-medium text-rose-950 transition-colors hover:border-rose-200 hover:bg-rose-100 hover:text-rose-950 focus-visible:border-rose-300 focus-visible:ring-rose-200 motion-reduce:transition-none max-[360px]:gap-1.5 max-[360px]:px-2 lg:px-5",
        className,
      )}
    >
      <Link
        href={routes.catalog}
        aria-current={isRouteActive(pathname, routes.catalog) ? "page" : undefined}
      >
        <LayoutGrid aria-hidden="true" className="size-4" strokeWidth={1.5} />
        Каталог
      </Link>
    </Button>
  );
}
