import { Link } from "@/shared/ui/link";
import TelegramSvg from "../assets/telegram.svg";
import { companyDetails, externalLinks, routes } from "@/shared/constants";

const legalDocs = [
  {
    label: "Политика конфиденциальности",
    href: routes.legal.privacyPolicy,
  },
  {
    label: "Публичная оферта",
    href: routes.legal.publicOffer,
  },
  {
    label: "Пользовательское соглашение",
    href: routes.legal.userAgreement,
  },
  {
    label: "Согласие на\u00a0обработку ПДн",
    href: routes.legal.personalDataConsent,
  },
  {
    label: "Политика Cookie",
    href: routes.legal.cookiePolicy,
  },
  {
    label: "Правила возврата",
    href: routes.legal.returnPolicy,
  },
  {
    label: "Правила промокодов",
    href: routes.legal.promocodes,
  },
];

export function LegalDocs() {
  const currentYear = new Date().getFullYear();

  return (
    <div className="border-t border-stone-800">
      <div className="container pt-8 pb-6 md:pt-10 md:pb-8">
        <h4 className="font-display mb-5 text-xs font-bold tracking-widest text-stone-500 uppercase">
          Правовые документы
        </h4>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-7">
          {legalDocs.map((doc) => (
            <Link
              key={doc.href}
              href={doc.href}
              className="flex items-center justify-center rounded-lg border border-stone-800 px-2 py-2.5 text-center text-[11px] leading-4 text-stone-500 transition-colors hover:text-rose-300 sm:px-3 sm:text-xs"
            >
              {doc.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="container flex flex-col items-center justify-between gap-4 border-t border-stone-800 py-6 md:flex-row md:py-8">
        <p className="text-sm text-stone-500">© {currentYear} ARTMATE. Все права защищены.</p>
        <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:gap-6 sm:text-left">
          <p className="flex flex-wrap justify-center gap-x-2 gap-y-1 text-xs leading-5 text-stone-600 sm:justify-end">
            <span className="font-medium">{companyDetails.shortName}</span>
            <span aria-hidden="true">·</span>
            <span>ИНН {companyDetails.inn}</span>
            <span aria-hidden="true">·</span>
            <span>
              {companyDetails.registrationNumberLabel} {companyDetails.registrationNumber}
            </span>
          </p>
          <div className="flex items-center gap-3">
            <a
              href={externalLinks.social.telegram}
              target="_blank"
              rel="noreferrer"
              aria-label="Telegram Artmate"
              className="text-stone-500 transition-colors hover:text-[#229ED9]"
            >
              <TelegramSvg className="h-5 w-5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
