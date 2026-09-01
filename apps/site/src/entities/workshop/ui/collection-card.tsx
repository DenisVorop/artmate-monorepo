import Image from "next/image";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import { routes } from "@/shared/constants";
import { Badge, Card, CardContent, CardTitle, Progress } from "@/shared/ui";
import { Link } from "@/shared/ui/link";

import type { OwnerWorkshop } from "../model";

type WorkshopCollectionCardProps = {
  collection: OwnerWorkshop["collections"][number];
};

export function WorkshopCollectionCard({ collection }: WorkshopCollectionCardProps) {
  const progress = Math.min(100, (collection.workCount / collection.expectedColoringCount) * 100);

  return (
    <Link
      href={routes.workshopCollection(collection.slug)}
      className="group block rounded-2xl focus-visible:ring-3 focus-visible:ring-rose-400 focus-visible:outline-none"
    >
      <Card className="h-full gap-0 overflow-hidden py-0 transition-shadow group-hover:shadow-md">
        <div className="relative aspect-[4/3] overflow-hidden bg-rose-50">
          <Image
            fill
            unoptimized
            src={collection.cover.url}
            alt={collection.cover.alt}
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        </div>
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-lg leading-snug">{collection.title}</CardTitle>
            <ArrowRight className="mt-0.5 size-5 shrink-0 text-rose-500" aria-hidden="true" />
          </div>
          {collection.hasPaidOrder ? (
            <Badge variant="secondary" className="gap-1 text-emerald-700">
              <CheckCircle2 aria-hidden="true" />
              Куплено в Artmate
            </Badge>
          ) : null}
          <div className="space-y-2">
            <div className="flex justify-between gap-3 text-sm">
              <span className="font-semibold text-stone-800">
                {collection.workCount} из {collection.expectedColoringCount} работ
              </span>
              <span className="text-stone-500">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} aria-label={`Прогресс ${collection.title}`} />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
