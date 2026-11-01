import { CalendarDays } from "lucide-react";
import type { MouseEventHandler } from "react";

import { routes } from "@/shared/constants";
import { cn } from "@/shared/lib";
import { Button, Card, CardContent, CardTitle } from "@/shared/ui";
import { Link } from "@/shared/ui/link";

import type { CommunityWorkSummary } from "../model";
import { PublicAssetImage } from "./public-asset-image";

export function CommunityWorkCard({
  work,
  className,
  onOpenImage,
  onPreviewIntent,
  href,
}: {
  work: CommunityWorkSummary;
  className?: string;
  onOpenImage?: MouseEventHandler<HTMLButtonElement>;
  onPreviewIntent?: () => void;
  href?: string;
}) {
  const content = (
    <Card className="h-full gap-0 overflow-hidden py-0 transition-shadow group-hover:shadow-md">
      <div className="relative aspect-[4/5] shrink-0 bg-stone-100">
        <PublicAssetImage
          src={work.submission.assets.thumb}
          alt={`Работа ${work.author.name}: ${work.official.coloring.title}`}
          className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
      </div>
      <CardContent className="flex flex-1 flex-col gap-2 p-4">
        <CardTitle
          title={work.official.coloring.title}
          className="line-clamp-2 min-h-11 text-base leading-snug"
        >
          {work.official.coloring.title}
        </CardTitle>
        <p className="truncate text-sm font-semibold text-stone-700" title={work.author.name}>
          {work.author.name}
        </p>
        <p className="flex items-center gap-1.5 text-xs text-stone-500">
          <CalendarDays className="size-3.5" aria-hidden="true" />
          {formatDate(work.submission.publishedAt)}
        </p>
      </CardContent>
    </Card>
  );
  const cardClassName = cn(
    "group block h-full rounded-2xl focus-visible:ring-3 focus-visible:ring-rose-400 focus-visible:outline-none",
    className,
  );

  return onOpenImage ? (
    <Button
      type="button"
      variant="ghost"
      onClick={onOpenImage}
      onPointerEnter={onPreviewIntent}
      onFocus={onPreviewIntent}
      onPointerDown={onPreviewIntent}
      aria-label={`Открыть изображение: ${work.official.coloring.title}`}
      className={cn("w-full p-0 text-left font-normal whitespace-normal", cardClassName)}
    >
      {content}
    </Button>
  ) : (
    <Link href={href ?? routes.publicWork(work.publicId)} className={cardClassName}>
      {content}
    </Link>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}
