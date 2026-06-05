import { Link } from "@/shared/ui/link";
import { ArrowRight } from "lucide-react";
import { externalLinks, routes } from "@/shared/constants";
import { LegalDocs } from "./ui/legal-docs";
import { BgText } from "./ui/bg-text";
import { Heading } from "./ui/heading";
import { Marketplaces } from "./ui/marketplaces";

export function Footer() {
  return (
    <footer className="overflow-hidden bg-stone-900 text-stone-300">
      <div className="relative pt-12 pb-10 md:pt-16 md:pb-14">
        {/* Декоративные блюры */}
        <div className="pointer-events-none absolute top-0 left-0 h-72 w-72 rounded-full bg-rose-500/10 blur-3xl" />
        <div className="pointer-events-none absolute top-0 right-0 h-60 w-60 rounded-full bg-violet-500/8 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/2 h-40 w-96 -translate-x-1/2 rounded-full bg-amber-500/5 blur-3xl" />

        <BgText />

        <div className="relative container">
          <div className="grid items-start gap-8 lg:grid-cols-[1fr_520px] lg:gap-16">
            <Heading />

            <Marketplaces />
          </div>

          {/* ── Разделитель ── */}
          <div className="full-width my-8 h-px bg-linear-to-r from-transparent via-stone-700 to-transparent md:my-12" />

          {/* ── Навигационные колонки ── */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-4 sm:gap-8">
            {/* Магазин */}
            <div>
              <div className="mb-5 flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full bg-rose-400" />
                <h4 className="font-display text-[11px] font-bold tracking-wide text-white uppercase sm:text-sm sm:tracking-wider">
                  Магазин
                </h4>
              </div>
              <ul className="space-y-3">
                {[
                  { label: "Каталог", to: routes.catalog },
                  { label: "Оплата и доставка", to: routes.paymentAndDelivery },
                  { label: "Ozon", href: externalLinks.marketplaces.ozon },
                  { label: "Wildberries", href: externalLinks.marketplaces.wildberries },
                ].map((l) => (
                  <li key={l.label}>
                    {"to" in l ? (
                      <Link
                        href={l.to!}
                        className="group flex items-center gap-1.5 text-xs text-stone-500 transition-colors hover:text-white sm:text-sm"
                      >
                        <ArrowRight className="-ml-4 h-3 w-3 opacity-0 transition-all duration-200 group-hover:ml-0 group-hover:opacity-100" />
                        {l.label}
                      </Link>
                    ) : (
                      <a
                        href={l.href}
                        target="_blank"
                        rel="noreferrer"
                        className="group flex items-center gap-1.5 text-xs text-stone-500 transition-colors hover:text-white sm:text-sm"
                      >
                        <ArrowRight className="-ml-4 h-3 w-3 opacity-0 transition-all duration-200 group-hover:ml-0 group-hover:opacity-100" />
                        {l.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* Бренд */}
            <div>
              <div className="mb-5 flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                <h4 className="font-display text-[11px] font-bold tracking-wide text-white uppercase sm:text-sm sm:tracking-wider">
                  Бренд
                </h4>
              </div>
              <ul className="space-y-3">
                {[
                  { label: "Блог", to: routes.blog },
                  { label: "FAQ", to: routes.faq },
                  { label: "Контакты", to: routes.contacts },
                ].map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.to}
                      className="group flex items-center gap-1.5 text-xs text-stone-500 transition-colors hover:text-white sm:text-sm"
                    >
                      <ArrowRight className="-ml-4 h-3 w-3 opacity-0 transition-all duration-200 group-hover:ml-0 group-hover:opacity-100" />
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Сотрудничество */}
            <div>
              <div className="mb-5 flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full bg-violet-400" />
                <h4 className="font-display text-[11px] font-bold tracking-wide text-white uppercase sm:text-sm sm:tracking-wider">
                  Сотрудничество
                </h4>
              </div>
              <ul className="space-y-3">
                {[{ label: "Написать нам", to: routes.contacts }].map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.to}
                      className="group flex items-center gap-1.5 text-xs text-stone-500 transition-colors hover:text-white sm:text-sm"
                    >
                      <ArrowRight className="-ml-4 h-3 w-3 opacity-0 transition-all duration-200 group-hover:ml-0 group-hover:opacity-100" />
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Оплата */}
            <div>
              <div className="mb-5 flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                <h4 className="font-display text-[11px] font-bold tracking-wide text-white uppercase sm:text-sm sm:tracking-wider">
                  Оплата
                </h4>
              </div>
              <ul className="space-y-3">
                {[{ label: "Онлайн-оплата", to: routes.paymentAndDelivery }].map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.to}
                      className="group flex items-center gap-1.5 text-xs text-stone-500 transition-colors hover:text-white sm:text-sm"
                    >
                      <ArrowRight className="-ml-4 h-3 w-3 opacity-0 transition-all duration-200 group-hover:ml-0 group-hover:opacity-100" />
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <LegalDocs />
    </footer>
  );
}
