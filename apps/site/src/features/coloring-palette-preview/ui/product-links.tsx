import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { routes } from "@/shared/constants/routes";
import { Card, CardContent } from "@/shared/ui";

// First catalog images, checked 2026-09-27, pre-sized to 256px for up to 128px at 2x DPR.
const products = [
  {
    label: "Печатный альбом",
    title: "Раскраска по номерам «Собачки»",
    action: "Перейти к альбому",
    href: routes.product(undefined, "raskraska-po-nomeram-sobachki"),
    image: "/previews/coloring-palette/album-product-256.webp",
    alt: "Обложка раскраски по номерам «Собачки»",
  },
  {
    label: "Акриловые маркеры",
    title: "Artmate · 168 цветов",
    action: "Перейти к маркерам",
    href: routes.product("markery", "akrilovye-markery-artmate-168-cvetov"),
    // Resized local copy of /uploads/products/product_markers_artmate_168/01.png.
    image: "/previews/coloring-palette/markers-product-256.webp",
    alt: "Акриловые маркеры Artmate 168 цветов в коробке",
  },
];

export function ProductLinks() {
  return (
    <section aria-label="Альбом и маркеры" className="grid gap-4 md:grid-cols-2">
      {products.map((product) => (
        <Card
          key={product.href}
          className="overflow-hidden rounded-2xl border border-stone-200 bg-white/75 py-0 shadow-sm ring-0"
        >
          <CardContent className="flex h-full min-h-48 items-center justify-between gap-4 p-5 sm:p-6">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold tracking-wide text-stone-500 uppercase">
                {product.label}
              </p>
              <h2 className="mt-2 text-base leading-snug font-bold sm:text-lg">{product.title}</h2>
              <Link
                href={product.href}
                className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-rose-700 underline-offset-4 hover:underline"
              >
                {product.action}
                <ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
              </Link>
            </div>
            <div className="relative aspect-3/4 w-24 shrink-0 rotate-3 rounded-xl border-4 border-white bg-white shadow-[0_8px_20px_-6px_rgba(28,25,23,0.25)] sm:w-28 xl:w-32">
              <Image
                src={product.image}
                alt={product.alt}
                fill
                unoptimized
                loading="eager"
                decoding="async"
                className="rounded-lg object-contain"
              />
            </div>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
