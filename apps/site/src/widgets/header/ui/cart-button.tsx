import { Badge, Button } from "@/shared";
import { ShoppingBag } from "lucide-react";

const cartItemsCount = 99;

export function CartButton() {
  return (
    <Button className="relative">
      <ShoppingBag size={16} />
      <span>Корзина</span>
      <Badge
        aria-label={`${cartItemsCount} товара в корзине`}
        className="absolute -top-2 -right-2 h-5 min-w-5 rounded-full border-2 border-white px-1 text-[11px] leading-none"
      >
        {cartItemsCount}
      </Badge>
    </Button>
  );
}
