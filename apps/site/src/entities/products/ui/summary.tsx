import { Badge } from "@/shared/ui";
import type { Product } from "../model";

type SummaryProps = {
  product: Product;
};

export function Summary({ product }: SummaryProps) {
  const price = product.price.toLocaleString("ru-RU");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{product.category}</Badge>
        {product.bestseller && <Badge className="bg-rose-500 text-white">Хит продаж</Badge>}
      </div>

      <div className="space-y-3">
        <h1 className="max-w-3xl text-3xl leading-tight font-bold text-foreground md:text-4xl">
          {product.title}
        </h1>
        <p className="text-3xl font-bold text-foreground">{price} ₽</p>
      </div>

      <p className="max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
        {product.description}
      </p>
    </div>
  );
}
