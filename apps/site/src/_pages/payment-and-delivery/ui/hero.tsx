import { ArrowRight, CreditCard, MapPin, PackageCheck, ShoppingBag } from "lucide-react";

import { routes } from "@/shared/constants";
import { cn } from "@/shared/lib";
import { Badge, Button } from "@/shared/ui";
import { Link } from "@/shared/ui/link";
import { PageTitle, SectionSubtitle } from "@/shared/ui/typography";

const journeyItems = [
  {
    icon: ShoppingBag,
    title: "Соберите корзину",
    description: "Выберите раскраски",
    status: "в корзине",
    iconClassName: "bg-rose-100 text-rose-600",
  },
  {
    icon: MapPin,
    title: "Найдите ПВЗ",
    description: "СДЭК или Ozon",
    status: "на карте",
    iconClassName: "bg-sky-100 text-sky-700",
  },
  {
    icon: CreditCard,
    title: "Оплатите онлайн",
    description: "T-Bank или Ozon Pay",
    status: "защищено",
    iconClassName: "bg-amber-100 text-amber-700",
  },
  {
    icon: PackageCheck,
    title: "Получите заказ",
    description: "Следите за статусом",
    status: "в кабинете",
    iconClassName: "bg-emerald-100 text-emerald-700",
  },
];

export function Hero() {
  return (
    <section
      className="relative isolate overflow-hidden border-b bg-gradient-to-br from-rose-50 via-background to-amber-50"
      aria-labelledby="payment-delivery-title"
    >
      <div
        aria-hidden="true"
        className="absolute -top-28 -right-24 size-80 rounded-full bg-amber-200/35 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-40 left-1/3 size-96 rounded-full bg-rose-200/30 blur-3xl"
      />

      <div className="relative container grid items-center gap-10 py-10 md:py-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(24rem,0.95fr)] lg:gap-14 lg:py-18">
        <div>
          <Badge
            variant="secondary"
            className="mb-5 border border-white/80 bg-background/80 text-rose-700 shadow-sm"
          >
            Оплата и доставка
          </Badge>
          <PageTitle id="payment-delivery-title" className="max-w-2xl text-balance">
            От корзины до <span className="text-rose-500">пункта выдачи</span>
          </PageTitle>
          <SectionSubtitle className="mt-5 max-w-xl text-pretty">
            Доставляем по России в города и регионы, где выбранная служба показывает доступный пункт
            выдачи. Адреса и стоимость покажем при оформлении, а ориентировочный срок — только если
            его передает служба доставки.
          </SectionSubtitle>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="bg-stone-900 text-white hover:bg-stone-800">
              <Link href={routes.catalog}>
                Перейти в каталог
                <ArrowRight data-icon="inline-end" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="bg-background/60">
              <Link href={routes.legal.returnPolicy}>Как вернуть заказ</Link>
            </Button>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-lg lg:justify-self-end">
          <div
            aria-hidden="true"
            className="absolute -right-4 -bottom-4 size-24 rotate-12 rounded-3xl bg-gradient-to-br from-rose-300 to-orange-300"
          />
          <div className="relative rounded-3xl border border-white/90 bg-background/90 p-5 shadow-xl shadow-rose-950/10 backdrop-blur md:p-6">
            <div className="flex items-center justify-between gap-4 border-b pb-4">
              <h2 className="font-heading text-base font-bold">Ваш маршрут заказа</h2>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                4 шага
              </span>
            </div>

            <ol className="mt-5 grid gap-4" aria-label="Краткий маршрут заказа">
              {journeyItems.map((item) => (
                <li
                  key={item.title}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex size-10 items-center justify-center rounded-xl",
                      item.iconClassName,
                    )}
                  >
                    <item.icon className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-foreground">{item.title}</span>
                    <span className="block text-xs text-muted-foreground">{item.description}</span>
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground">{item.status}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
