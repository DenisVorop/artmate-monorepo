import { CheckCircle2, Headphones, ShoppingBag } from "lucide-react";

import { routes } from "@/shared/constants";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui";
import { Link } from "@/shared/ui/link";

export function GuestCheckoutSuccess() {
  return (
    <section className="container py-10 md:py-14">
      <Card className="mx-auto max-w-3xl">
        <CardHeader className="items-start gap-4 border-b">
          <span className="flex size-12 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200">
            <CheckCircle2 className="size-6" />
          </span>
          <div className="space-y-2">
            <CardTitle className="text-2xl">Оплата проверяется</CardTitle>
            <CardDescription className="text-base leading-6">
              Информация о заказе и письмо для входа или восстановления доступа отправлены на email.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row">
          <Button asChild size="lg">
            <Link href={routes.catalog}>
              <ShoppingBag data-icon="inline-start" />
              Вернуться в каталог
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href={routes.contacts}>
              <Headphones data-icon="inline-start" />
              Связаться с поддержкой
            </Link>
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
