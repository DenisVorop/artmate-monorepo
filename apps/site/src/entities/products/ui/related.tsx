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
    <section className="space-y-6" aria-labelledby="related-products-title">
      <div className="space-y-2">
        <SectionTitle id="related-products-title" className="text-foreground">
          Вам также может понравиться
        </SectionTitle>
        <SectionSubtitle>Похожие темы и&nbsp;другие альбомы Artmate.</SectionSubtitle>
      </div>

      <div className="relative right-[50%] left-[50%] -mr-[50vw] -ml-[50vw] w-screen sm:right-auto sm:left-auto sm:mr-0 sm:ml-0 sm:w-auto">
        <ul className="flex snap-x snap-mandatory scroll-px-4 [scrollbar-width:thin] gap-4 overflow-x-auto overscroll-x-contain px-4 pb-4 sm:grid sm:[scrollbar-width:auto] sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3 xl:grid-cols-4 xl:gap-6">
          {products.map((product, index) => (
            <li
              key={product.id}
              className="w-[min(82vw,20rem)] flex-none snap-start sm:w-auto sm:flex-auto"
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
