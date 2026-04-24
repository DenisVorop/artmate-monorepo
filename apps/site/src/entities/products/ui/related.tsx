import type { Product } from "../model";
import { ProductCard } from "./product-card";

type RelatedProps = {
  products: Product[];
  onAddToCart?: (_product: Product, _quantity?: number) => Promise<void> | void;
};

export function Related({ products, onAddToCart }: RelatedProps) {
  if (products.length === 0) {
    return null;
  }

  return (
    <section className="space-y-6" aria-labelledby="related-products-title">
      <div className="space-y-2">
        <h2 id="related-products-title" className="text-2xl font-bold text-foreground">
          Вам также может понравиться
        </h2>
        <p className="text-sm text-muted-foreground">Похожие темы и&nbsp;другие альбомы Artmate.</p>
      </div>

      <div className="relative right-[50%] left-[50%] -mr-[50vw] -ml-[50vw] w-screen sm:right-auto sm:left-auto sm:mr-0 sm:ml-0 sm:w-auto">
        <ul className="flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto overscroll-x-contain px-4 pb-4 [scrollbar-width:thin] sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0 sm:[scrollbar-width:auto] lg:grid-cols-4 lg:gap-6">
          {products.map((product) => (
            <li
              key={product.id}
              className="w-[min(82vw,20rem)] flex-none snap-start sm:w-auto sm:flex-auto"
            >
              <ProductCard product={product} onAddToCart={onAddToCart} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
