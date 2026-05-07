import { ExternalLink, MessageSquareText } from "lucide-react";

import { externalLinks } from "@/shared/constants";

const marketplaceLinks = [
  {
    id: "ozon",
    title: "Ozon",
    href: externalLinks.marketplaces.ozon,
    description: "Отзывы, рейтинг продавца и условия доставки на Ozon.",
    className: "hover:border-[#005BFF]/40 hover:bg-[#005BFF]/5 hover:text-[#005BFF]",
  },
  {
    id: "wildberries",
    title: "Wildberries",
    href: externalLinks.marketplaces.wildberries,
    description: "Отзывы покупателей, оценки и наличие на Wildberries.",
    className: "hover:border-[#CB11AB]/40 hover:bg-[#CB11AB]/5 hover:text-[#CB11AB]",
  },
] as const;

export function MarketplaceLinks() {
  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-500">
          <MessageSquareText className="size-5" />
        </span>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Отзывы доступны на маркетплейсах</p>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Перейдите на площадку, чтобы посмотреть актуальные отзывы покупателей и рейтинг.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {marketplaceLinks.map((marketplace) => (
          <a
            key={marketplace.id}
            href={marketplace.href}
            target="_blank"
            rel="noreferrer"
            aria-label={`Открыть отзывы Artmate на ${marketplace.title}`}
            className={`group flex min-h-32 flex-col justify-between rounded-lg border bg-background p-4 text-foreground transition-colors ${marketplace.className}`}
          >
            <span>
              <span className="text-base font-semibold">{marketplace.title}</span>
              <span className="mt-2 block text-sm leading-6 text-muted-foreground">
                {marketplace.description}
              </span>
            </span>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium">
              Открыть
              <ExternalLink className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
