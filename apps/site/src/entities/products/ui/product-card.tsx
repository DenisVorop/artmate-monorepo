import Image from "next/image";
import type { ReactNode } from "react";

import { Badge } from "@/shared/ui";
import { routes } from "@/shared/constants";
import { cn, shouldBypassNextImageOptimization } from "@/shared/lib";
import { AspectRatio } from "@/shared/ui/aspect-ratio";
import { Card, CardContent, CardDescription, CardFooter, CardTitle } from "@/shared/ui/card";
import { Link } from "@/shared/ui/link";
import type { Product } from "../model";

interface ProductCardProps {
  product: Product;
  eagerImage?: boolean;
  footerAction?: ReactNode;
  mediaAction?: ReactNode;
  mediaActionViewport?: "all" | "desktop";
  mediaActionVisibility?: "always" | "hover";
}

export function ProductCard({
  product,
  eagerImage = false,
  footerAction,
  mediaAction,
  mediaActionViewport = "all",
  mediaActionVisibility = "hover",
}: ProductCardProps) {
  const price = product.price.toLocaleString("ru-RU");
  const productHref = routes.product(product.categorySlug, product.slug);
  const showMediaActionAlways = mediaActionVisibility === "always";

  return (
    <Card className="group/product h-full gap-0 py-0 transition-shadow duration-300 hover:shadow-md">
      <div className="relative">
        <Link href={productHref} className="block overflow-hidden bg-muted">
          <AspectRatio ratio={3 / 4} className="relative">
            <Image
              fill
              src={product.image}
              alt={product.title}
              unoptimized={shouldBypassNextImageOptimization(product.image)}
              loading={eagerImage ? "eager" : "lazy"}
              fetchPriority={eagerImage ? "high" : undefined}
              sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover transition-transform duration-700 group-hover/product:scale-105"
            />
          </AspectRatio>
        </Link>

        {product.isHit && (
          <Badge className="absolute top-3 left-3 bg-rose-500 text-white shadow-sm">Хит</Badge>
        )}

        {mediaAction ? (
          <div
            className={cn(
              "pointer-events-none absolute inset-0 items-end p-4 transition-opacity duration-200",
              mediaActionViewport === "desktop" ? "hidden md:flex" : "flex",
              showMediaActionAlways
                ? "bg-gradient-to-t from-stone-900/30 via-transparent to-transparent opacity-100"
                : "bg-gradient-to-t from-stone-900/30 via-transparent to-transparent opacity-100 md:bg-stone-900/20 md:opacity-0 md:group-focus-within/product:opacity-100 md:group-hover/product:opacity-100",
            )}
          >
            {mediaAction}
          </div>
        ) : null}
      </div>

      <CardContent className="flex flex-1 flex-col gap-1 px-4 pt-4 pb-3">
        {product.category && (
          <CardDescription className="text-xs tracking-wide uppercase">
            {product.category}
          </CardDescription>
        )}
        <CardTitle role="heading" aria-level={3} className="font-display leading-snug font-bold">
          <Link href={productHref} className="text-stone-900 transition-colors hover:text-rose-500">
            {product.title}
          </Link>
        </CardTitle>
      </CardContent>

      <CardFooter className="mt-auto justify-between gap-3 border-t-0 bg-transparent px-4 pt-0 pb-4">
        <p className="shrink-0 text-base font-semibold text-stone-700 md:text-sm">{price} ₽</p>
        {footerAction}
      </CardFooter>
    </Card>
  );
}
