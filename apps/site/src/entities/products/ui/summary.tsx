import { Badge } from "@/shared/ui";
import { PageTitle } from "@/shared/ui/typography";
import type { Product } from "../model";

type SummaryProps = {
  product: Product;
};

export function Summary({ product }: SummaryProps) {
  const price = product.price.toLocaleString("ru-RU");

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
        <p className="text-3xl font-bold text-foreground">{price} ₽</p>
      </div>

      <p className="max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
        {product.description}
      </p>
    </div>
  );
}
