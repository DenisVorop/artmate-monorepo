import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui";

type ProductPriceProps = {
  price: number;
  originalPrice?: number;
  variant?: "compact" | "card" | "detail";
  className?: string;
};

export function ProductPrice({
  price,
  originalPrice,
  variant = "compact",
  className,
}: ProductPriceProps) {
  const hasDiscount = originalPrice !== undefined && originalPrice > price;
  const discountPercent = hasDiscount
    ? Math.floor(((originalPrice - price) / originalPrice) * 100)
    : 0;

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span
          className={cn(
            "font-semibold whitespace-nowrap tabular-nums",
            variant === "detail" && "text-3xl font-bold",
            variant === "card" && "text-xl leading-6 font-bold tracking-tight",
            variant === "compact" && "text-base md:text-sm",
            hasDiscount ? "text-rose-700" : "text-foreground",
          )}
        >
          <span className="sr-only">{hasDiscount ? "Цена со скидкой: " : "Цена: "}</span>
          {price.toLocaleString("ru-RU")} ₽
        </span>
        {hasDiscount && (
          <s
            className={cn(
              "whitespace-nowrap text-muted-foreground",
              variant === "detail" && "text-lg",
              variant === "card" && "text-sm",
              variant === "compact" && "text-xs",
            )}
          >
            <span className="sr-only">Обычная цена: </span>
            {originalPrice.toLocaleString("ru-RU")} ₽
          </s>
        )}
        {hasDiscount && variant === "detail" && discountPercent > 0 && (
          <Badge
            variant="secondary"
            className="self-center border-rose-100 bg-rose-50 text-rose-700"
          >
            −{discountPercent}%
          </Badge>
        )}
      </div>
      {hasDiscount && variant === "detail" && (
        <p className="text-sm text-rose-700">
          Экономия {(originalPrice - price).toLocaleString("ru-RU")} ₽
        </p>
      )}
    </div>
  );
}
