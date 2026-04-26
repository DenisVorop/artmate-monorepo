import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { routes } from "@/shared/constants";
import { cn } from "@/shared/lib";
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
