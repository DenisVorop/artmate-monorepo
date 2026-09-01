import { CalendarDays } from "lucide-react";

import { routes } from "@/shared/constants";
import { Card, CardContent, CardTitle } from "@/shared/ui";
import { Link } from "@/shared/ui/link";

import type { CommunityWorkSummary } from "../model";
import { PublicAssetImage } from "./public-asset-image";

export function CommunityWorkCard({ work }: { work: CommunityWorkSummary }) {
  return (
    <Link
      href={routes.publicWork(work.publicId)}
      className="group block rounded-2xl focus-visible:ring-3 focus-visible:ring-rose-400 focus-visible:outline-none"
    >
      <Card className="h-full gap-0 overflow-hidden py-0 transition-shadow group-hover:shadow-md">
        <div className="relative aspect-[4/5] bg-stone-100">
          <PublicAssetImage
            publicId={work.publicId}
            alt={`Работа ${work.author.name}: ${work.official.coloring.title}`}
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        </div>
        <CardContent className="space-y-2 p-4">
          <CardTitle className="text-base leading-snug">{work.official.coloring.title}</CardTitle>
          <p className="text-sm font-semibold text-stone-700">{work.author.name}</p>
          <p className="flex items-center gap-1.5 text-xs text-stone-500">
            <CalendarDays className="size-3.5" aria-hidden="true" />
            {formatDate(work.submission.publishedAt)}
          </p>
        </CardContent>
      </Card>
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
