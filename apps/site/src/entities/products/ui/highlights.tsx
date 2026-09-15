import { ListChecks, Truck } from "lucide-react";

import { Card, CardContent, CardTitle } from "@/shared/ui";
import type { ProductCharacteristic } from "../model";

export function Highlights({ characteristics }: { characteristics: ProductCharacteristic[] }) {
  const items = [
    {
      id: "delivery",
      title: "Доставка",
      description: "Оформление заказа через корзину сайта",
      icon: Truck,
    },
    ...characteristics
      .filter((item) => item.isHighlighted)
      .slice(0, 2)
      .map((item) => ({
        id: `characteristic:${item.name}`,
        title: item.name,
        description: item.value,
        icon: ListChecks,
      })),
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => {
        const Icon = item.icon;

        return (
          <Card key={item.id} size="sm" className="min-w-0 bg-muted/30">
            <CardContent className="flex gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground ring-1 ring-border">
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 space-y-1 wrap-anywhere">
                <CardTitle className="text-sm">{item.title}</CardTitle>
                <p className="text-xs leading-5 text-muted-foreground">{item.description}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
