import type { ReactNode } from "react";

import { SectionSubtitle, SectionTitle } from "@/shared/ui/typography";
import type { Product } from "../model";
import { ProductCard } from "./product-card";

type RelatedProps = {
  products: Product[];
  renderProductCard?: (_product: Product, _index: number) => ReactNode;
};

export function Related({ products, renderProductCard }: RelatedProps) {
  if (products.length === 0) {
    return null;
  }

  return (
    <section className="w-full min-w-0 space-y-6" aria-labelledby="related-products-title">
      <div className="space-y-2">
        <SectionTitle id="related-products-title" className="text-foreground">
          Вам также может понравиться
        </SectionTitle>
        <SectionSubtitle>Другие товары Artmate.</SectionSubtitle>
      </div>

      <div className="w-full min-w-0 overflow-hidden [contain:inline-size]">
        <ul className="flex w-full min-w-0 snap-x snap-mandatory scroll-px-1 [scrollbar-width:thin] flex-nowrap gap-4 overflow-x-auto overscroll-x-contain p-1 pb-4 sm:gap-5 xl:gap-6">
          {products.map((product, index) => (
            <li
              key={product.id}
              className="w-[min(82vw,20rem)] min-w-0 flex-none snap-start sm:w-[calc((100%-1.25rem)/2)] lg:w-[calc((100%-2.5rem)/3)] xl:w-[calc((100%-4.5rem)/4)]"
            >
              {renderProductCard ? (
                renderProductCard(product, index)
              ) : (
                <ProductCard product={product} />
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
