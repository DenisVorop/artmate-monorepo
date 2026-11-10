import Image from "next/image";
import { ArrowUpRight, BookOpen } from "lucide-react";

import { ProductPrice, type Product } from "@/entities/products";
import { routes } from "@/shared/constants";
import { Button, Card, CardContent, CtaGradientLink } from "@/shared/ui";

export function AlbumCard({
  product,
  relatedProduct,
  onNavigate,
}: {
  product?: Product;
  relatedProduct: { title: string; slug: string; categorySlug?: string };
  onNavigate(): void;
}) {
  return (
    <section aria-label="Альбом этой работы" className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-medium text-stone-500">
        <BookOpen className="size-3.5" aria-hidden="true" />
        <span>Альбом этой работы</span>
        <span aria-hidden="true" className="h-px flex-1 bg-stone-200" />
      </div>
      <Card className="gap-0 bg-white py-4 shadow-sm ring-stone-200">
        <CardContent className="space-y-4">
          <div className="flex items-start gap-4 md:gap-3 lg:gap-4">
            {product && (
              <div className="relative h-32 w-24 shrink-0 overflow-hidden rounded-lg bg-rose-50/60 md:h-28 md:w-20 lg:h-32 lg:w-24">
                <Image
                  src={product.image}
                  alt={product.title}
                  fill
                  sizes="96px"
                  className="object-contain p-1"
                />
              </div>
            )}
            <div className="min-w-0 space-y-2">
              <h3 className="font-heading text-lg leading-snug font-semibold text-stone-900">
                {product?.title ?? relatedProduct.title}
              </h3>
              {product && (
                <ProductPrice
                  price={product.price}
                  originalPrice={product.originalPrice}
                  variant="card"
                />
              )}
              {product?.isOutOfStock && (
                <p className="text-xs text-stone-500">Сейчас нет в наличии</p>
              )}
            </div>
          </div>
          <Button
            asChild
            size="lg"
            className="min-h-11 w-full border-0 bg-gradient-to-r from-rose-500 via-rose-400 to-orange-400 font-semibold text-white shadow-sm shadow-rose-500/20 hover:from-rose-500/95 hover:via-rose-400/95 hover:to-orange-400/95"
          >
            <CtaGradientLink
              data-site-action="gallery_album_open"
              data-site-product-link=""
              href={routes.product(
                product?.categorySlug ?? relatedProduct.categorySlug,
                relatedProduct.slug,
              )}
              onClick={onNavigate}
            >
              Посмотреть альбом <ArrowUpRight />
            </CtaGradientLink>
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
