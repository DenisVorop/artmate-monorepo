import { Badge } from "@/shared/ui";
import { PageTitle } from "@/shared/ui/typography";
import type { Product } from "../model";
import { ProductPrice } from "./price";

type SummaryProps = {
  product: Product;
};

export function Summary({ product }: SummaryProps) {
  return (
    <div className="space-y-4">
      {(product.category || product.isHit) && (
        <div className="flex flex-wrap items-center gap-2">
          {product.category && <Badge variant="secondary">{product.category}</Badge>}
          {product.isHit && <Badge className="bg-rose-500 text-white">Хит продаж</Badge>}
        </div>
      )}

      <div className="space-y-3">
        <PageTitle className="max-w-3xl text-foreground">{product.title}</PageTitle>
        <ProductPrice
          price={product.price}
          originalPrice={product.originalPrice}
          variant="detail"
        />
      </div>
    </div>
  );
}
