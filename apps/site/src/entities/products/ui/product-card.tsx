import Image from "next/image";
import type { MouseEventHandler, ReactNode, Ref } from "react";

import { Badge } from "@/shared/ui";
import { routes } from "@/shared/constants";
import { cn, ozonImageLoader, shouldBypassNextImageOptimization } from "@/shared/lib";
import { AspectRatio } from "@/shared/ui/aspect-ratio";
import { Card, CardContent, CardDescription, CardFooter, CardTitle } from "@/shared/ui/card";
import { Link } from "@/shared/ui/link";
import type { Product } from "../model";
import { ProductPrice } from "./price";

interface ProductCardProps {
  product: Product;
  eagerImage?: boolean;
  imageSizes?: string;
  mediaAspectRatio?: number;
  variant?: "default" | "plain";
  footerAction?: ReactNode;
  mediaBadge?: ReactNode;
  mediaAction?: ReactNode;
  mediaActionViewport?: "all" | "desktop";
  mediaActionVisibility?: "always" | "hover";
  onOpen?: MouseEventHandler<HTMLAnchorElement>;
  cardRef?: Ref<HTMLDivElement>;
}

export function ProductCard({
  product,
  eagerImage = false,
  imageSizes = "(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw",
  mediaAspectRatio = 3 / 4,
  variant = "default",
  footerAction,
  mediaBadge,
  mediaAction,
  mediaActionViewport = "all",
  mediaActionVisibility = "hover",
  onOpen,
  cardRef,
}: ProductCardProps) {
  const productHref = routes.product(product.categorySlug, product.slug);
  const showMediaActionAlways = mediaActionVisibility === "always";

  return (
    <Card
      ref={cardRef}
      className={cn(
        "group/product h-full gap-0 py-0 transition-shadow duration-300 hover:shadow-md",
        variant === "plain" && "rounded-none bg-transparent ring-0 hover:shadow-none",
      )}
    >
      <div className="relative">
        <Link
          data-site-product-link=""
          href={productHref}
          className={cn(
            "block overflow-hidden bg-muted",
            variant === "plain" && "rounded-lg bg-transparent",
          )}
          onClick={onOpen}
        >
          <AspectRatio ratio={mediaAspectRatio} className="relative">
            <Image
              fill
              src={product.image}
              alt={product.title}
              loader={
                shouldBypassNextImageOptimization(product.image) ? ozonImageLoader : undefined
              }
              loading={eagerImage ? "eager" : "lazy"}
              fetchPriority={eagerImage ? "high" : undefined}
              sizes={imageSizes}
              className="object-cover transition-transform duration-700 group-hover/product:scale-105"
            />
          </AspectRatio>
        </Link>

        <div className="absolute top-3 left-3 z-10 empty:hidden">
          {product.isHit && <Badge className="h-6 bg-rose-500 text-white shadow-sm">Хит</Badge>}
        </div>

        <div className="peer/media-badge absolute bottom-0 left-0 z-10 max-w-full empty:hidden">
          {mediaBadge}
        </div>

        {mediaAction ? (
          <div
            className={cn(
              "pointer-events-none absolute inset-0 items-end p-4 transition-opacity duration-200 peer-[:not(:empty)]/media-badge:pb-10",
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

      <CardContent
        className={cn("flex flex-1 flex-col gap-1 px-4 pt-4 pb-2", variant === "plain" && "px-0")}
      >
        {product.category && variant !== "plain" && (
          <CardDescription className="text-xs tracking-wide uppercase">
            {product.category}
          </CardDescription>
        )}
        <CardTitle role="heading" aria-level={3} className="font-display leading-snug font-bold">
          <Link
            data-site-product-link=""
            href={productHref}
            className="line-clamp-3 text-stone-900 transition-colors hover:text-rose-500"
            onClick={onOpen}
            aria-label={product.title}
            title={product.title}
          >
            {product.title}
          </Link>
        </CardTitle>
      </CardContent>

      <CardFooter
        className={cn(
          "mt-auto flex-wrap items-center justify-between gap-3 border-t-0 bg-transparent px-4 pt-0 pb-4",
          variant === "plain" && "px-0",
        )}
      >
        <ProductPrice
          price={product.price}
          originalPrice={product.originalPrice}
          variant="card"
          className="min-w-32 flex-1"
        />
        {footerAction}
      </CardFooter>
    </Card>
  );
}
