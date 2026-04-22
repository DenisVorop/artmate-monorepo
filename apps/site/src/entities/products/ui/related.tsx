import type { Product } from "../model";
import { ProductCard } from "./product-card";

type RelatedProps = {
  products: Product[];
};

export function Related({ products }: RelatedProps) {
  if (products.length === 0) {
    return null;
  }

  return (
    <section className="space-y-6" aria-labelledby="related-products-title">
      <div className="space-y-2">
        <h2 id="related-products-title" className="text-2xl font-bold text-foreground">
          Вам также может понравиться
        </h2>
        <p className="text-sm text-muted-foreground">Похожие темы и другие альбомы Artmate.</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
