import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { MenuIcon } from "lucide-react";
import { routes } from "@/shared/constants";
import { cn } from "@/shared/lib";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui";
import { Link } from "@/shared/ui/link";

const navItems = [
  {
    href: routes.catalog,
    title: "Каталог",
  },
  {
    href: routes.paymentAndDelivery,
    title: "Оплата и доставка",
  },
  {
    href: routes.contacts,
    title: "Контакты",
  },
  {
    href: routes.blog,
    title: "Блог",
  },
  {
    href: routes.faq,
    title: "FAQ",
  },
];

function isRouteActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function ActiveLinkIndicator() {
  return (
    <motion.span
      layoutId="site-header-active-link"
      className="absolute right-2 bottom-0 left-2 h-0.5 rounded-full bg-gradient-to-r from-rose-500 to-orange-400"
      transition={{ type: "spring", stiffness: 500, damping: 38 }}
    />
  );
}

export function Menu() {
  const pathname = usePathname();

  return (
    <ul className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
      {navItems.map((item) => {
        const isActive = isRouteActive(pathname, item.href);

        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative inline-flex h-9 items-center rounded-md px-3 transition-colors hover:bg-rose-50 hover:text-rose-950",
                isActive ? "text-rose-950" : "text-muted-foreground",
              )}
            >
              {isActive && <ActiveLinkIndicator />}
              <span className="relative z-[1]">{item.title}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function MobileMenu() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          aria-label="Открыть меню"
          className="lg:hidden"
        >
          <MenuIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={12}
        className="w-[min(calc(100vw-2rem),20rem)] border-stone-200 bg-white p-2 text-stone-900 shadow-xl shadow-stone-900/10 lg:hidden"
      >
        {navItems.map((item) => {
          const isActive = isRouteActive(pathname, item.href);

          return (
            <DropdownMenuItem key={item.href} asChild onSelect={() => setIsOpen(false)}>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "relative flex min-h-11 w-full items-center rounded-md px-3 text-sm font-medium text-muted-foreground",
                  "hover:bg-rose-50 hover:text-rose-950",
                  isActive && "bg-rose-50 text-rose-950",
                )}
              >
                {isActive && (
                  <span className="absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-gradient-to-b from-rose-500 to-orange-400" />
                )}
                {item.title}
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
