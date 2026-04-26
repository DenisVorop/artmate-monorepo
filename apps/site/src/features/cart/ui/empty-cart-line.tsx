import { ShoppingBag } from "lucide-react";

import { routes } from "@/shared/constants";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardTitle,
  CtaGradientLink,
} from "@/shared/ui";

export function EmptyCartLine() {
  return (
    <Card className="overflow-hidden py-0">
      <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-xl">В корзине пока пусто</CardTitle>
          <CardDescription>
            Добавьте раскраски из каталога, чтобы оформить заказ позже.
          </CardDescription>
        </div>

        <Button
          asChild
          className="border-0 bg-gradient-to-r from-rose-500 via-rose-400 to-orange-400 font-semibold text-white shadow-sm shadow-rose-500/20 hover:from-rose-500/95 hover:via-rose-400/95 hover:to-orange-400/95"
        >
          <CtaGradientLink href={routes.catalog}>
            <ShoppingBag data-icon="inline-start" />
            Перейти в каталог
          </CtaGradientLink>
        </Button>
      </CardContent>
    </Card>
  );
}
