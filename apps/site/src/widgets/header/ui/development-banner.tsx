import { MessageCircle, ShoppingBag } from "lucide-react";

import { externalLinks } from "@/shared/constants";
import { Button } from "@/shared/ui";

const marketplaceLinks = [
  {
    label: "Ozon",
    href: externalLinks.marketplaces.ozon,
  },
  {
    label: "Wildberries",
    href: externalLinks.marketplaces.wildberries,
  },
];

export function DevelopmentBanner() {
  return (
    <div className="border-b border-[#c79a5b]/70 bg-[#2b1c14] text-[#f8ead8] shadow-sm shadow-[#2b1c14]/20">
      <div className="container flex flex-col gap-2.5 py-2.5 text-xs leading-5 sm:flex-row sm:items-center sm:justify-between sm:text-sm">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d9b276]/70 bg-[#4a3021] px-2 py-0.5 text-[11px] font-semibold tracking-wide text-[#ffe3b5] uppercase">
            <span className="relative flex size-2" aria-hidden="true">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#f2c36b] opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-[#f2c36b]" />
            </span>
            В разработке
          </span>
          <span>
            Сайт временно работает в тестовом режиме. Для покупки используйте маркетплейсы,
            для связи - Telegram.
          </span>
        </p>

        <div className="flex flex-wrap items-center gap-1.5">
          {marketplaceLinks.map((link) => (
            <Button
              key={link.href}
              asChild
              size="xs"
              variant="outline"
              className="border-[#d9b276]/70 bg-[#f8ead8] text-[#2b1c14] hover:bg-white hover:text-[#2b1c14]"
            >
              <a href={link.href} target="_blank" rel="noreferrer">
                <ShoppingBag data-icon="inline-start" />
                {link.label}
              </a>
            </Button>
          ))}
          <Button
            asChild
            size="xs"
            variant="secondary"
            className="bg-[#c79a5b] text-[#2b1c14] hover:bg-[#d9b276]"
          >
            <a href={externalLinks.social.telegram} target="_blank" rel="noreferrer">
              <MessageCircle data-icon="inline-start" />
              Telegram
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
