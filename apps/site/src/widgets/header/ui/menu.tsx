"use client";

import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui";
import { Link } from "@/shared/ui/link";

import { desktopHelpItems, desktopNavItems, isRouteActive } from "../lib/navigation";

export function Menu() {
  const pathname = usePathname();
  const isHelpActive = desktopHelpItems.some((item) => isRouteActive(pathname, item.href));

  return (
    <ul className="flex items-center gap-5 text-sm font-medium xl:gap-7">
      {desktopNavItems.map((item) => {
        const isActive = isRouteActive(pathname, item.href);

        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative inline-flex h-11 items-center whitespace-nowrap transition-colors hover:text-stone-950 focus-visible:ring-2 focus-visible:ring-stone-300",
                isActive
                  ? "text-stone-950 after:absolute after:inset-x-0 after:bottom-1 after:h-px after:bg-rose-500"
                  : "text-stone-500",
              )}
            >
              {item.title}
            </Link>
          </li>
        );
      })}
      <li>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                "relative h-11 gap-1.5 rounded-none px-0 transition-colors hover:bg-transparent hover:text-stone-950 focus-visible:ring-stone-300 aria-expanded:bg-transparent aria-expanded:text-stone-950",
                isHelpActive
                  ? "text-stone-950 after:absolute after:inset-x-0 after:bottom-1 after:h-px after:bg-rose-500"
                  : "text-stone-500",
              )}
            >
              Помощь
              <ChevronDown
                aria-hidden="true"
                className="size-3.5 transition-transform group-aria-expanded/button:rotate-180"
                strokeWidth={1.5}
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={16}
            className="w-56 rounded-2xl border-stone-100 p-2 shadow-lg shadow-stone-900/5"
          >
            {desktopHelpItems.map((item) => (
              <DropdownMenuItem key={item.href} asChild>
                <Link
                  href={item.href}
                  aria-current={isRouteActive(pathname, item.href) ? "page" : undefined}
                  className="min-h-11 rounded-lg px-3 text-sm"
                >
                  {item.title}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </li>
    </ul>
  );
}
