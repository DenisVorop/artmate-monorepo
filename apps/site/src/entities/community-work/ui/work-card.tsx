import { CalendarDays } from "lucide-react";
import type { MouseEventHandler, ReactNode } from "react";

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
  likeAction,
}: {
  work: CommunityWorkSummary;
  className?: string;
  onOpenImage?: MouseEventHandler<HTMLButtonElement>;
  onPreviewIntent?: () => void;
  href?: string;
  likeAction?: ReactNode;
}) {
  const triggerClassName =
    "absolute inset-0 z-10 block h-full w-full rounded-2xl focus-visible:ring-3 focus-visible:ring-rose-400 focus-visible:ring-inset focus-visible:outline-none";

  return (
    <Card
      className={cn(
        "group relative h-full gap-0 overflow-hidden py-0 transition-shadow hover:shadow-md",
        className,
      )}
    >
      {onOpenImage ? (
        <Button
          type="button"
          variant="ghost"
          onClick={onOpenImage}
          onPointerEnter={onPreviewIntent}
          onFocus={onPreviewIntent}
          onPointerDown={onPreviewIntent}
          aria-label={`Открыть изображение: ${work.official.coloring.title}`}
          className={cn(triggerClassName, "p-0 hover:bg-transparent")}
        />
      ) : (
        <Link
          href={href ?? routes.publicWork(work.publicId)}
          aria-label={`Открыть работу «${work.official.coloring.title}» автора ${work.author.name}`}
          className={triggerClassName}
        />
      )}
      <div className="pointer-events-none relative aspect-[4/5] shrink-0 bg-stone-100">
        <PublicAssetImage
          src={work.submission.assets.thumb}
          alt={`Работа ${work.author.name}: ${work.official.coloring.title}`}
          className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
      </div>
      <CardContent className="pointer-events-none relative flex min-w-0 flex-1 flex-col gap-2 p-4">
        <CardTitle
          title={work.official.coloring.title}
          className="truncate text-base leading-snug"
        >
          {work.official.coloring.title}
        </CardTitle>
        <div
          className={cn(
            "grid items-center gap-2",
            likeAction ? "grid-cols-[minmax(0,1fr)_auto]" : "grid-cols-1",
          )}
        >
          <div className="flex min-w-0 flex-col gap-1">
            <p className="truncate text-sm font-semibold text-stone-700" title={work.author.name}>
              {work.author.name}
            </p>
            <p className="flex min-w-0 items-center gap-1.5 text-xs text-stone-500">
              <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{formatDate(work.submission.publishedAt)}</span>
            </p>
          </div>
          {likeAction && <div className="pointer-events-auto relative z-20">{likeAction}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}
