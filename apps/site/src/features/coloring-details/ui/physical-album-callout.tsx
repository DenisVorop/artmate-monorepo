import { ArrowUpRight } from "lucide-react";
import Image from "next/image";

import type { Coloring } from "@/entities/coloring";
import { routes } from "@/shared/constants";
import { shouldBypassNextImageOptimization } from "@/shared/lib";
import { Link } from "@/shared/ui/link";

type PhysicalAlbumCalloutProps = {
  coverImage?: string;
  product: Coloring["collection"]["product"];
};

export function PhysicalAlbumCallout({ coverImage, product }: PhysicalAlbumCalloutProps) {
  return (
    <aside className="flex max-w-3xl items-center gap-4 rounded-2xl border border-stone-200 bg-white/75 p-3 shadow-sm sm:gap-5 sm:p-4">
      {coverImage ? (
        <div className="relative aspect-3/4 w-16 shrink-0 overflow-hidden rounded-lg bg-muted sm:w-20">
          <Image
            fill
            src={coverImage}
            alt={product.title}
            unoptimized={shouldBypassNextImageOptimization(coverImage)}
            sizes="80px"
            className="object-cover"
          />
        </div>
      ) : null}
      <div className="min-w-0 space-y-1.5">
        <p className="text-xs font-semibold tracking-wide text-stone-500 uppercase">
          Печатный альбом
        </p>
        <h2 className="font-display text-base leading-snug font-bold text-stone-900 sm:text-lg">
          {product.title}
        </h2>
        <Link
          href={routes.product(product.category?.slug, product.slug)}
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-rose-700 underline-offset-4 hover:underline"
        >
          Купить печатный альбом
          <ArrowUpRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </aside>
  );
}
