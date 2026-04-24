import { Badge, Button } from "@/shared/ui";
import { ShoppingBag } from "lucide-react";

const cartItemsCount = 99;

export function CartButton() {
  return (
    <Button className="relative">
      <ShoppingBag size={16} />
      <span>Корзина</span>
      <Badge
        aria-label={`${cartItemsCount} товара в\u00a0корзине`}
        className="absolute -top-2 -right-2 h-5 min-w-5 rounded-full border-2 border-white bg-rose-500 px-1 text-[11px] leading-none text-white"
      >
        {cartItemsCount}
      </Badge>
    </Button>
  );
}
