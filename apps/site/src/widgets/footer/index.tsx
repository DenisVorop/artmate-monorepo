import { Link } from "@/shared/ui/link";
import { ArrowRight } from "lucide-react";
import { externalLinks, routes } from "@/shared";
import { LegalDocs } from "./ui/legal-docs";
import { BgText } from "./ui/bg-text";
import { Heading } from "./ui/heading";
import { Marketplaces } from "./ui/marketplaces";

export function Footer() {
  return (
    <footer className="overflow-hidden bg-stone-900 text-stone-300">
      <div className="relative pt-16 pb-14">
        {/* Декоративные блюры */}
        <div className="pointer-events-none absolute top-0 left-0 h-72 w-72 rounded-full bg-rose-500/10 blur-3xl" />
        <div className="pointer-events-none absolute top-0 right-0 h-60 w-60 rounded-full bg-violet-500/8 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/2 h-40 w-96 -translate-x-1/2 rounded-full bg-amber-500/5 blur-3xl" />

        <BgText />

        <div className="relative container">
          <div className="grid items-start gap-10 lg:grid-cols-[1fr_520px] lg:gap-16">
            <Heading />

            <Marketplaces />
          </div>

          {/* ── Разделитель ── */}
          <div className="full-width my-12 h-px bg-linear-to-r from-transparent via-stone-700 to-transparent" />

          {/* ── Навигационные колонки ── */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {/* Магазин */}
            <div>
              <div className="mb-5 flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full bg-rose-400" />
                <h4 className="font-display text-sm font-bold tracking-wider text-white uppercase">
                  Магазин
                </h4>
              </div>
              <ul className="space-y-3">
                {[
                  { label: "Каталог", to: routes.catalog },
                  { label: "Ozon", href: externalLinks.marketplaces.ozon },
                  { label: "Wildberries", href: externalLinks.marketplaces.wildberries },
                ].map((l) => (
                  <li key={l.label}>
                    {"to" in l ? (
                      <Link
                        href={l.to!}
                        className="group flex items-center gap-1.5 text-sm text-stone-500 transition-colors hover:text-white"
                      >
                        <ArrowRight className="-ml-4 h-3 w-3 opacity-0 transition-all duration-200 group-hover:ml-0 group-hover:opacity-100" />
                        {l.label}
                      </Link>
                    ) : (
                      <a
                        href={l.href}
                        target="_blank"
                        rel="noreferrer"
                        className="group flex items-center gap-1.5 text-sm text-stone-500 transition-colors hover:text-white"
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
                <h4 className="font-display text-sm font-bold tracking-wider text-white uppercase">
                  Бренд
                </h4>
              </div>
              <ul className="space-y-3">
                {[
                  { label: "Блог", to: routes.blog },
                  { label: "Галерея работ", to: routes.gallery },
                  { label: "FAQ", to: routes.faq },
                  { label: "Контакты", to: routes.contacts },
                ].map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.to}
                      className="group flex items-center gap-1.5 text-sm text-stone-500 transition-colors hover:text-white"
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
                <h4 className="font-display text-sm font-bold tracking-wider text-white uppercase">
                  Сотрудничество
                </h4>
              </div>
              <ul className="space-y-3">
                {[{ label: "Написать нам", to: routes.contacts }].map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.to}
                      className="group flex items-center gap-1.5 text-sm text-stone-500 transition-colors hover:text-white"
                    >
                      <ArrowRight className="-ml-4 h-3 w-3 opacity-0 transition-all duration-200 group-hover:ml-0 group-hover:opacity-100" />
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Доставка */}
            <div>
              <div className="mb-5 flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                <h4 className="font-display text-sm font-bold tracking-wider text-white uppercase">
                  Доставка
                </h4>
              </div>
              <ul className="space-y-3 text-sm text-stone-500">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0 text-emerald-400">✓</span>
                  <span>Ozon Логистика — бесплатно</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0 text-emerald-400">✓</span>
                  <span>Wildberries — бесплатно</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0 text-stone-600">→</span>
                  <span>Курьер — от&nbsp;350 ₽</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <LegalDocs />
    </footer>
  );
}
