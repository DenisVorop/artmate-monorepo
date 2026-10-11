import { Badge } from "@/shared/ui";
import type { ReactNode } from "react";
import { PageTitle } from "@/shared/ui/typography";
import type { Product } from "../model";
import { ProductPrice } from "./price";

type SummaryProps = {
  product: Product;
  cashback?: ReactNode;
};

export function Summary({ product, cashback }: SummaryProps) {
  return (
    <div className="space-y-4">
      {(product.category || product.isHit || cashback) && (
        <div className="flex flex-wrap items-center gap-2 empty:hidden">
          {product.category && (
            <Badge variant="secondary" className="h-6">
              {product.category}
            </Badge>
          )}
          {product.isHit && <Badge className="h-6 bg-rose-500 text-white">Хит продаж</Badge>}
          {cashback}
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
