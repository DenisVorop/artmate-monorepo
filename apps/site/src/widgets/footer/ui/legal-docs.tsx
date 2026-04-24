import { Link } from "@/shared/ui/link";
import InstagramSvg from "../assets/instagram.svg";
import TelegramSvg from "../assets/telegram.svg";
import { externalLinks, routes } from "@/shared/constants";

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
];

export function LegalDocs() {
  const currentYear = new Date().getFullYear();

  return (
    <div className="border-t border-stone-800">
      <div className="container pt-10 pb-8">
        <h4 className="font-display mb-5 text-xs font-bold tracking-widest text-stone-500 uppercase">
          Правовые документы
        </h4>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {legalDocs.map((doc) => (
            <Link
              key={doc.href}
              href={doc.href}
              className="flex items-center justify-center rounded-lg border border-stone-800 px-3 py-2.5 text-center text-xs text-stone-500 transition-colors hover:text-rose-300"
            >
              {doc.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="container flex flex-col items-center justify-between gap-4 border-t border-stone-800 py-8 md:flex-row">
        <p className="text-sm text-stone-500">© {currentYear} ARTMATE. Все права защищены.</p>
        <div className="flex items-center gap-6">
          <p className="text-xs text-stone-600">ИНН: XXXXXXXXXX · ОГРН: XXXXXXXXXXXXX</p>
          <div className="flex items-center gap-3">
            <a
              href={externalLinks.social.instagram}
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram Artmate"
              className="text-stone-500 transition-colors hover:text-white"
            >
              <InstagramSvg className="h-5 w-5" />
            </a>
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
