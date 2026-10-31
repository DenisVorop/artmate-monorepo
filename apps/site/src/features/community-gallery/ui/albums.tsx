"use client";

import Image from "next/image";
import { ArrowUpRight, BookOpen } from "lucide-react";

import {
  getCommunityCollectionTitle,
  getGalleryCollectionSlug,
  useGalleryFilters,
} from "@/entities/community-work";
import { ProductPrice, useProductsData } from "@/entities/products";
import { routes } from "@/shared/constants";
import { cn } from "@/shared/lib";
import { Button, Card, CardContent, CtaGradientLink } from "@/shared/ui";
import { Link } from "@/shared/ui/link";
import { SectionTitle } from "@/shared/ui/typography";

export function GalleryAlbums({ collectionSlug }: { collectionSlug?: string }) {
  const { data: filters } = useGalleryFilters();
  const { data: products } = useProductsData();
  if (!filters?.collections.length) return null;
  const current = filters.collections.find((collection) => collection.slug === collectionSlug);
  const collections = current ? [current] : filters.collections;
  const otherCollections = current
    ? filters.collections.filter((collection) => collection.slug !== current.slug)
    : [];

  return (
    <section aria-labelledby="gallery-albums-title" className="space-y-6">
      <SectionTitle id="gallery-albums-title">
        {current ? "Альбомы подборки" : "Альбомы из галереи"}
      </SectionTitle>
      <ul
        className={cn(
          current
            ? "max-w-2xl"
            : "flex snap-x snap-proximity gap-4 overflow-x-auto overscroll-x-contain px-1 pt-1 pb-4",
        )}
      >
        {collections.map((collection) => {
          const product = products?.products.find(
            (item) => item.digitalCollection?.slug === collection.slug,
          );
          const title = getCommunityCollectionTitle(collection.title);
          return (
            <li
              key={collection.slug}
              className={cn(!current && "w-[min(21rem,calc(100vw-3rem))] shrink-0 snap-start")}
            >
              <Card className="h-full gap-0 bg-white py-5 shadow-none ring-stone-200">
                <CardContent className={cn("flex h-full flex-col gap-5", !current && "px-5")}>
                  <div className="flex items-start gap-4">
                    {product ? (
                      <Link
                        href={routes.product(product.categorySlug, product.slug)}
                        className={cn(
                          "relative block h-28 w-20 shrink-0 overflow-hidden rounded-lg bg-stone-50",
                          !current && "h-44 w-30",
                        )}
                      >
                        <Image
                          src={product.image}
                          alt={product.title}
                          fill
                          sizes={current ? "80px" : "120px"}
                          className="object-contain p-1"
                        />
                      </Link>
                    ) : (
                      <BookOpen className="size-8 shrink-0 text-stone-400" aria-hidden="true" />
                    )}
                    <div
                      className={cn(
                        "min-w-0 space-y-2",
                        !current && "flex-1 space-y-4 self-center",
                      )}
                    >
                      <h3 className="font-heading text-xl leading-snug font-semibold">{title}</h3>
                      {current && product && (
                        <ProductPrice
                          price={product.price}
                          originalPrice={product.originalPrice}
                          variant="card"
                        />
                      )}
                      {current ? (
                        <Link
                          href={routes.coloringCollection(collection.slug)}
                          className="inline-flex min-h-11 items-center gap-1.5 text-sm text-stone-600 underline-offset-4 hover:underline"
                        >
                          Цифровая версия
                          <ArrowUpRight className="size-3.5" aria-hidden="true" />
                        </Link>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="h-auto min-h-9 w-full justify-between gap-1.5 border-stone-200 bg-stone-50 px-2.5 py-1.5 text-left text-xs whitespace-normal hover:bg-stone-100"
                          >
                            <Link href={routes.coloringCollection(collection.slug)}>
                              <span className="min-w-0">Цифровая версия</span>
                              <ArrowUpRight
                                className="size-3.5 text-stone-500"
                                aria-hidden="true"
                              />
                            </Link>
                          </Button>
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="h-auto min-h-9 w-full justify-between gap-1.5 border-stone-200 bg-stone-50 px-2.5 py-1.5 text-left text-xs whitespace-normal hover:bg-stone-100"
                          >
                            <Link
                              href={routes.galleryCollection(
                                getGalleryCollectionSlug(collection.slug),
                              )}
                            >
                              <span className="min-w-0">Работы участников</span>
                              <ArrowUpRight
                                className="size-3.5 text-stone-500"
                                aria-hidden="true"
                              />
                            </Link>
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-auto flex flex-col gap-2">
                    {product && (
                      <Button
                        asChild
                        size="lg"
                        className="min-h-11 w-full border-0 bg-gradient-to-r from-rose-500 via-rose-400 to-orange-400 font-semibold text-white shadow-sm shadow-rose-500/20 hover:from-rose-500/95 hover:via-rose-400/95 hover:to-orange-400/95"
                      >
                        <CtaGradientLink href={routes.product(product.categorySlug, product.slug)}>
                          Посмотреть альбом {current && <ArrowUpRight />}
                        </CtaGradientLink>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
      {otherCollections.length > 0 && (
        <nav aria-label="Галереи других альбомов" className="space-y-3 pt-2">
          <h3 className="text-base font-semibold">Работы из других альбомов</h3>
          <ul className="flex flex-wrap gap-2">
            {otherCollections.map((collection) => (
              <li key={collection.slug}>
                <Button asChild variant="outline" className="min-h-11 rounded-full bg-white px-4">
                  <Link href={routes.galleryCollection(getGalleryCollectionSlug(collection.slug))}>
                    {getCommunityCollectionTitle(collection.title)}
                  </Link>
                </Button>
              </li>
            ))}
            <li>
              <Button asChild variant="outline" className="min-h-11 rounded-full bg-white px-4">
                <Link href={routes.gallery}>Вся галерея</Link>
              </Button>
            </li>
          </ul>
        </nav>
      )}
    </section>
  );
}
