"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useProductsData } from "@/entities/products";
import { CartProductCard } from "@/features/cart";
import { ProductCashback } from "@/features/product-cashback";
import { routes } from "@/shared/constants";
import { cn } from "@/shared/lib";
import { DataState } from "@/shared/ui";
import { Skeleton } from "@/shared/ui/skeleton";
import { SectionTitle } from "@/shared/ui/typography";
import { selectHomeProducts } from "../lib/select-products";

export function HomeProducts({ className }: { className?: string }) {
  const { data, isError, isPending } = useProductsData();
  const products = selectHomeProducts(data?.products ?? []);

  return (
    <section
      id="home-products"
      aria-labelledby="home-products-title"
      className={cn("container scroll-mt-24", className)}
    >
      <div className="mb-5 flex items-center justify-between gap-4 md:mb-6">
        <SectionTitle id="home-products-title" style={{ fontSize: "clamp(1.25rem, 3vw, 1.75rem)" }}>
          Раскраски Artmate
        </SectionTitle>
        <Link
          href={`${routes.catalog}?category=colorings`}
          className="flex min-h-11 shrink-0 items-center gap-1.5 text-xs font-semibold hover:text-rose-600 sm:text-sm"
        >
          Смотреть все <ArrowUpRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
      {products.length ? (
        <ul className="grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-x-5 md:grid-cols-4 md:gap-y-8">
          {products.map((product, index) => (
            <li
              key={product.id}
              className={cn("min-w-0", (index >= 4 || !product.isHit) && "hidden md:block")}
            >
              <CartProductCard
                product={product}
                variant="plain"
                imageSizes="(min-width: 1568px) 361px, (min-width: 768px) calc((100vw - 124px) / 4), (min-width: 640px) calc((100vw - 84px) / 2), (min-width: 601px) calc((100vw - 76px) / 2), calc((100vw - 64px) / 2)"
                list="home_catalog"
                position={index + 1}
                cashback={<ProductCashback product={product} />}
              />
            </li>
          ))}
        </ul>
      ) : isPending ? (
        <div
          role="status"
          aria-label="Загружаем раскраски"
          className="grid grid-cols-2 gap-3 md:grid-cols-4"
        >
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton
              key={index}
              className={cn("aspect-[3/5] rounded-xl", index >= 4 && "hidden md:block")}
            />
          ))}
        </div>
      ) : (
        <DataState
          variant={isError ? "error" : "empty"}
          title={
            isError
              ? "Не удалось загрузить раскраски"
              : isPending
                ? "Загружаем раскраски"
                : "Раскраски пока не добавлены"
          }
          description={
            isError ? "Обновите страницу или попробуйте позже." : "Новые альбомы появятся здесь."
          }
        />
      )}
    </section>
  );
}
