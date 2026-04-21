import { ExternalLink, MessageCircle } from "lucide-react";

import { Button, externalLinks } from "@/shared";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";

export function MoreReviewsCard() {
  return (
    <Card
      role="article"
      className="h-full justify-between gap-0 border-dashed border-rose-200 bg-rose-50/70 py-0 ring-0"
    >
      <CardHeader className="px-5 pt-5">
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-white text-rose-400 shadow-sm shadow-rose-100">
          <MessageCircle className="h-5 w-5" aria-hidden="true" />
        </div>

        <CardTitle className="font-display text-lg leading-snug font-bold text-stone-900">
          Еще больше отзывов
        </CardTitle>
      </CardHeader>

      <CardContent className="px-5 pt-2">
        <CardDescription className="mt-2 text-sm leading-relaxed text-stone-500">
          Смотрите оценки, фото и комментарии покупателей на маркетплейсах.
        </CardDescription>
      </CardContent>

      <CardFooter className="flex-wrap gap-2 border-t-0 bg-transparent px-5 pt-5 pb-5">
        <Button
          asChild
          variant="outline"
          size="sm"
          className="border-[#005BFF]/20 bg-white text-[#005BFF] hover:border-[#005BFF]/40 hover:bg-[#005BFF]/10"
        >
          <a href={externalLinks.marketplaces.ozon} target="_blank" rel="noreferrer">
            Ozon
            <ExternalLink data-icon="inline-end" />
          </a>
        </Button>
        <Button
          asChild
          variant="outline"
          size="sm"
          className="border-[#CB11AB]/20 bg-white text-[#CB11AB] hover:border-[#CB11AB]/40 hover:bg-[#CB11AB]/10"
        >
          <a href={externalLinks.marketplaces.wildberries} target="_blank" rel="noreferrer">
            Wildberries
            <ExternalLink data-icon="inline-end" />
          </a>
        </Button>
      </CardFooter>
    </Card>
  );
}
