import { ArrowRight } from "lucide-react";
import { SectionLabel, SectionTitle } from "@/shared/ui/typography";
import { Button, CtaGradientLink, DataState, DecorDots } from "@/shared/ui";
import { routes } from "@/shared/constants";
import { cn } from "@/shared/lib";
import { ProductCard, type Product } from "@/entities/products";

type BestsellersProps = {
  products: Product[];
  className?: string;
  onAddToCart?: (_product: Product, _quantity?: number) => Promise<void> | void;
};

export function Bestsellers({ products, className, onAddToCart }: BestsellersProps) {
  const bestsellers = products.filter((p) => p.bestseller).slice(0, 4);

  return (
    <section
      aria-labelledby="best-sellers-title"
      className={cn("relative isolate overflow-hidden bg-[#f9f8f6]", className)}
    >
      <DecorDots
        tone="amber"
        className="top-6 left-4 z-0 h-44 w-64 -rotate-12 opacity-60 sm:left-[12%] lg:top-8 lg:left-[calc(50%-38rem)]"
      />
      <DecorDots className="top-28 -right-28 z-0 h-72 w-[26rem] rotate-12 opacity-65 sm:right-[-4rem] lg:top-24 lg:right-[calc(50%-44rem)]" />
      <DecorDots
        tone="indigo"
        className="bottom-8 left-[8%] z-0 hidden h-52 w-72 rotate-6 opacity-55 sm:block lg:bottom-6 lg:left-[calc(50%-42rem)]"
      />
      <DecorDots
        tone="amber"
        className="right-[18%] bottom-16 z-0 hidden h-40 w-56 rotate-[18deg] opacity-45 lg:block"
      />

      <div className="relative z-10 container">
        <div className="mb-10 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <SectionLabel className="mb-3" color="amber">
              Популярное
            </SectionLabel>
            <SectionTitle id="best-sellers-title">Хиты продаж</SectionTitle>
          </div>

          <Button
            asChild
            size="lg"
            className="border-0 bg-gradient-to-r from-rose-500 via-rose-400 to-orange-400 font-semibold text-white shadow-sm shadow-rose-500/20 hover:from-rose-500/95 hover:via-rose-400/95 hover:to-orange-400/95"
          >
            <CtaGradientLink href={routes.catalog}>
              Весь каталог
              <ArrowRight
                data-icon="inline-end"
                className="transition-transform group-hover/button:translate-x-0.5"
              />
            </CtaGradientLink>
          </Button>
        </div>

        {bestsellers.length > 0 ? (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {bestsellers.map((product) => (
              <li key={product.id} className="h-full">
                <ProductCard product={product} onAddToCart={onAddToCart} />
              </li>
            ))}
          </ul>
        ) : (
          <DataState
            title="Хиты продаж пока не выбраны"
            description="Когда товары получат отметку хита, они появятся в этом блоке."
          />
        )}
      </div>
    </section>
  );
}
