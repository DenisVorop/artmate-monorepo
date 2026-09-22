import { Link } from "@/shared/ui/link";
import { Button } from "@/shared/ui/button";
import TelegramSvg from "../assets/telegram.svg";
import { companyDetails, externalLinks, routes } from "@/shared/constants";

export function LegalDocs() {
  const currentYear = new Date().getFullYear();

  return (
    <div className="border-t border-stone-800">
      <div className="container py-3 md:py-4">
        <Button
          asChild
          variant="link"
          className="h-11 justify-start px-0 text-xs font-normal text-stone-400 underline-offset-4 hover:text-stone-300 focus-visible:text-stone-300 sm:text-sm"
        >
          <Link href={routes.legal.index}>Правовые документы</Link>
        </Button>
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
