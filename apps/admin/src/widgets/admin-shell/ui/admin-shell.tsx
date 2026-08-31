import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  FileText,
  Images,
  Megaphone,
  LogOut,
  MailCheck,
  PackageSearch,
  PanelsTopLeft,
  Percent,
  SearchCode,
  SquareKanban,
  Users,
} from "lucide-react";

import { logoutAdminAction } from "@/features/auth";
import { routes } from "@/shared/constants";
import { Badge, Button } from "@/shared/ui";

type NavigationItem = {
  readonly label: string;
  readonly href: string;
  readonly Icon: LucideIcon;
};

type AdminShellProps = {
  readonly activePath?: string;
  readonly children: ReactNode;
};

const navigation: readonly NavigationItem[] = [
  { label: "Заявки", href: routes.orders, Icon: SquareKanban },
  { label: "Товары", href: routes.products, Icon: PackageSearch },
  { label: "Цифровые версии", href: routes.digitalVersions, Icon: Images },
  { label: "Подборки", href: routes.catalogLandings, Icon: PanelsTopLeft },
  { label: "Промокоды", href: routes.promoCodes, Icon: Percent },
  { label: "Блог", href: routes.blog, Icon: FileText },
  { label: "SEO", href: routes.seo, Icon: SearchCode },
  { label: "Баннеры", href: routes.featureBanners, Icon: Megaphone },
  { label: "Рассылки", href: routes.mailings, Icon: MailCheck },
  { label: "Пользователи", href: routes.users, Icon: Users },
];

export function AdminShell({
  activePath = routes.users,
  children,
}: AdminShellProps) {
  return (
    <main className="min-h-screen bg-muted/30">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="border-sidebar-border bg-sidebar text-sidebar-foreground lg:sticky lg:top-0 lg:h-screen lg:border-r">
          <div className="flex h-full flex-col gap-6 p-4">
            <div className="flex items-center gap-3 px-2 py-1">
              <Badge className="size-10 rounded-lg p-0 text-base">A</Badge>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold">Artmate</p>
                <p className="text-sm text-sidebar-foreground/60">Admin</p>
              </div>
            </div>

            <nav className="grid gap-1" aria-label="Основная навигация">
              {navigation.map((item) => {
                const isActive = item.href === activePath;

                return (
                  <Button
                    key={item.label}
                    asChild
                    variant={isActive ? "secondary" : "ghost"}
                    className="justify-start"
                  >
                    <a
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <item.Icon data-icon="inline-start" aria-hidden="true" />
                      {item.label}
                    </a>
                  </Button>
                );
              })}
            </nav>

            <form action={logoutAdminAction} className="mt-auto">
              <Button
                className="w-full justify-start"
                type="submit"
                variant="ghost"
              >
                <LogOut data-icon="inline-start" aria-hidden="true" />
                Выйти
              </Button>
            </form>
          </div>
        </aside>

        {children}
      </div>
    </main>
  );
}
