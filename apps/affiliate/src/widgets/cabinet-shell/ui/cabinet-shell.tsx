"use client";

import Link from "next/link";
import {
  FileText,
  LayoutDashboard,
  Sparkles,
  TicketPercent,
  WalletCards,
} from "lucide-react";
import type { ReactNode } from "react";

import { useAffiliatePartnerData } from "@/entities/affiliate-partner";
import { LogoutButton } from "@/features/auth/client";
import { routes } from "@/shared/constants";
import { cn } from "@/shared/lib";
import { DataState } from "@/shared/ui";

type CabinetShellProps = {
  readonly activeRoute: "/" | "/codes" | "/cooperation" | "/payouts";
  readonly children: ReactNode;
};

const navigation = [
  { href: routes.home, icon: LayoutDashboard, label: "Обзор" },
  { href: routes.codes, icon: TicketPercent, label: "Промокоды" },
  { href: routes.payouts, icon: WalletCards, label: "Выплаты" },
  { href: routes.cooperation, icon: FileText, label: "Сотрудничество" },
] as const;

export function CabinetShell({ activeRoute, children }: CabinetShellProps) {
  const { data: partner, isError, isPending } = useAffiliatePartnerData();

  if (isPending) {
    return <DataState status="loading" />;
  }

  if (isError || !partner) {
    return <DataState status="error" />;
  }

  const userLabel = partner.userName || partner.userEmail || "Партнёр Artmate";

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="hidden border-r border-white/8 bg-ink text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:p-5">
        <BrandMark inverted />
        <nav className="mt-12 grid gap-2" aria-label="Основная навигация">
          {navigation.map(({ href, icon: Icon, label }) => (
            <Link
              className={cn(
                "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-white/62 transition hover:bg-white/8 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400",
                activeRoute === href &&
                  "bg-white text-ink hover:bg-white hover:text-ink",
              )}
              href={href}
              key={href}
            >
              <Icon aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto min-w-0 rounded-3xl border border-white/10 bg-white/6 p-4">
          <p className="min-w-0 break-words text-sm font-bold [overflow-wrap:anywhere]">
            {userLabel}
          </p>
          <p className="mt-1 text-xs text-white/55">Активный партнёр</p>
          <div className="mt-3 [&_button]:text-white/70 [&_button:hover]:bg-white/8 [&_button:hover]:text-white">
            <LogoutButton compact />
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 border-b border-border/70 bg-background/92 px-4 py-3 backdrop-blur-xl lg:hidden">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <BrandMark />
            <LogoutButton />
          </div>
          <nav
            className="mx-auto mt-3 grid max-w-6xl grid-cols-4 gap-1.5"
            aria-label="Основная навигация"
          >
            {navigation.map(({ href, label }) => (
              <Link
                className={cn(
                  "min-w-0 rounded-xl px-1.5 py-2 text-center text-[0.7rem] leading-tight font-bold break-words text-muted-foreground [overflow-wrap:anywhere] sm:px-3 sm:text-xs",
                  activeRoute === href && "bg-ink text-white",
                )}
                href={href}
                key={href}
              >
                {label}
              </Link>
            ))}
          </nav>
        </header>
        {children}
      </div>
    </div>
  );
}

function BrandMark({ inverted = false }: { readonly inverted?: boolean }) {
  return (
    <Link
      className="inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rose-500"
      href={routes.home}
    >
      <span className="grid size-9 place-items-center rounded-xl bg-brand-gradient text-white shadow-brand">
        <Sparkles className="size-4" aria-hidden="true" />
      </span>
      <span
        className={cn(
          "font-heading text-lg font-bold tracking-tight",
          inverted ? "text-white" : "text-ink",
        )}
      >
        artmate
      </span>
      <span
        className={cn(
          "text-[0.62rem] font-extrabold tracking-[0.16em] uppercase",
          inverted ? "text-white/45" : "text-muted-foreground",
        )}
      >
        partner
      </span>
    </Link>
  );
}
