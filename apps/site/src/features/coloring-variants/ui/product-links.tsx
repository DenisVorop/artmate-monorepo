"use client";

import { ArrowUpRight } from "lucide-react";
import Image from "next/image";

import type { Coloring } from "@/entities/coloring-variants";
import { getProductById, useProductsData } from "@/entities/products";
import { routes } from "@/shared/constants";
import { Card, CardContent } from "@/shared/ui";
import { Link } from "@/shared/ui/link";

type Product = Coloring["collection"]["product"];
type MaterialKind = Coloring["variants"][number]["kind"];

const materialActions: Record<MaterialKind, string> = {
  MARKER: "Перейти к маркерам",
  PENCIL: "Перейти к карандашам",
  PAINT: "Перейти к краскам",
  OTHER: "Перейти к набору",
};

export function ProductLinks({
  album,
  material,
  materialKind,
}: {
  album: Product;
  material?: Product;
  materialKind?: MaterialKind;
}) {
  const products = useProductsData();
  const links = [
    { product: album, label: "Печатный альбом", action: "Перейти к альбому" },
    ...(material
      ? [
          {
            product: material,
            label: "Выбранная палитра",
            action: materialActions[materialKind ?? "OTHER"],
          },
        ]
      : []),
  ];

  return (
    <section aria-label="Альбом и материалы" className="grid gap-4 md:grid-cols-2">
      {links.map(({ product, label, action }) => {
        const image =
          !products.isError && products.data
            ? getProductById(products.data.products, product.id)?.image
            : undefined;
        return (
          <Card
            key={product.id}
            className="overflow-hidden rounded-2xl border border-stone-200 bg-white/75 py-0 shadow-sm ring-0"
          >
            <CardContent className="flex h-full min-h-48 items-center justify-between gap-4 p-5 sm:p-6">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold tracking-wide text-stone-500 uppercase">
                  {label}
                </p>
                <h2 className="mt-2 text-base leading-snug font-bold sm:text-lg">
                  {product.title}
                </h2>
                <Link
                  href={routes.product(product.category?.slug, product.slug)}
                  className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-rose-700 underline-offset-4 hover:underline"
                >
                  {action}
                  <ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
                </Link>
              </div>
              {image && (
                <div className="relative aspect-3/4 w-24 shrink-0 rotate-3 rounded-xl border-4 border-white bg-white shadow-[0_8px_20px_-6px_rgba(28,25,23,0.25)] sm:w-28 xl:w-32">
                  <Image
                    src={image}
                    alt={product.title}
                    fill
                    sizes="(min-width: 1280px) 128px, (min-width: 640px) 112px, 96px"
                    className="rounded-lg object-contain"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}
