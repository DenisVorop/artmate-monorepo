"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Plus } from "lucide-react";
import { useProductsData } from "@/entities/products";
import { CartProductCard } from "@/features/cart";
import { ProductCashback } from "@/features/product-cashback";
import { routes } from "@/shared/constants";
import { cn } from "@/shared/lib";
import { Button } from "@/shared/ui";
import { SectionTitle } from "@/shared/ui/typography";

export function HomeCompanion({ className }: { className?: string }) {
  const { data, isError } = useProductsData();
  const album = data?.products.find((product) => product.slug === "raskraska-po-nomeram-kotiki-2");
  const markers = data?.products.find(
    (product) => product.slug === "akrilovye-markery-artmate-168-cvetov",
  );
  if (isError || !album || !markers) return null;
  const digitalHref = album.digitalCollection
    ? routes.digitalCollection(album.digitalCollection.slug)
    : undefined;

  return (
    <section className={cn("container", className)} aria-labelledby="companion-title">
      <div className="rounded-2xl bg-white p-4 sm:p-6 lg:p-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <SectionTitle id="companion-title" style={{ fontSize: "clamp(1.25rem, 3vw, 1.75rem)" }}>
            К альбому — подходящие маркеры
          </SectionTitle>
          <p className="max-w-90 text-sm leading-relaxed text-stone-500">
            В цифровом образце обозначения на рисунке связаны с номерами маркеров Artmate.
          </p>
        </div>
        <div className="grid items-start gap-5 md:grid-cols-[1.2fr_1fr] lg:grid-cols-[1fr_1fr] lg:gap-8">
          <div className="relative grid grid-cols-2 items-start gap-3 sm:gap-5">
            {[album, markers].map((product, index) => (
              <CartProductCard
                key={product.id}
                product={product}
                variant="plain"
                imageSizes="(min-width: 1568px) 342px, (min-width: 1024px) calc((100vw - 200px) / 4), (min-width: 768px) calc(27.3vw - 46px), (min-width: 640px) calc((100vw - 132px) / 2), (min-width: 601px) calc((100vw - 108px) / 2), calc((100vw - 96px) / 2)"
                cashback={<ProductCashback product={product} />}
                list="home_pairing"
                position={index + 1}
              />
            ))}
            <span
              className="pointer-events-none absolute top-[22%] left-1/2 z-10 grid size-11 -translate-x-1/2 place-items-center rounded-full border-4 border-white bg-gradient-to-br from-rose-500 to-orange-400 text-white shadow-lg shadow-rose-500/25 sm:size-12"
              aria-hidden="true"
            >
              <Plus className="size-6" strokeWidth={3} />
            </span>
          </div>
          {digitalHref && (
            <div className="flex min-w-0 flex-col overflow-hidden rounded-xl bg-white p-4 sm:p-6">
              <div className="relative flex h-64 items-center justify-center overflow-hidden rounded-lg bg-rose-50 p-6 pb-14 sm:h-72">
                <Image
                  src="/home/cats-colored.webp"
                  alt="Цветной образец картины из альбома «Котики 2»"
                  width={960}
                  height={1346}
                  sizes="(min-width: 640px) 149px, 126px"
                  className="h-full w-auto max-w-full rotate-3 object-contain shadow-lg"
                />
                <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-white bg-white/90 px-4 py-2.5 text-xs whitespace-nowrap shadow-sm backdrop-blur-md">
                  <span className="size-5 rounded bg-[#b67e7c]" aria-hidden="true" />
                  <span>
                    На рисунке <b>A</b>
                  </span>
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                  <span>
                    Маркер <b>501</b>
                  </span>
                </div>
              </div>
              <h3 className="font-display mt-5 text-lg leading-snug font-bold">
                Цвета уже подобраны
              </h3>
              <p className="mt-2 max-w-90 text-sm leading-relaxed text-stone-500">
                Откройте образец на телефоне, найдите обозначение и возьмите маркер с нужным
                номером. Раскрашивайте на бумаге.
              </p>
              <Button asChild variant="outline" className="mt-5 min-h-11 w-full bg-white">
                <Link href={digitalHref}>
                  Открыть цифровую версию <ArrowUpRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
