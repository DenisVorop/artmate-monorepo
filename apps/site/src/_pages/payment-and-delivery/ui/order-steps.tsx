import { ArrowUpRight, CreditCard, MapPinned, PackageCheck, ShoppingBag } from "lucide-react";

import { cn } from "@/shared/lib";
import { SectionLabel, SectionSubtitle, SectionTitle } from "@/shared/ui/typography";

const steps = [
  {
    icon: ShoppingBag,
    title: "Добавьте товары",
    description: "Проверьте состав заказа и количество раскрасок в корзине.",
    surfaceClassName: "bg-rose-50",
    accentClassName: "bg-rose-100 text-rose-700",
  },
  {
    icon: MapPinned,
    title: "Выберите доставку",
    description: "Найдите доступный пункт выдачи СДЭК или Ozon на карте.",
    surfaceClassName: "bg-sky-50",
    accentClassName: "bg-sky-100 text-sky-700",
  },
  {
    icon: CreditCard,
    title: "Оплатите заказ",
    description: "Перейдите на защищенную страницу T-Bank или Ozon Pay.",
    surfaceClassName: "bg-amber-50",
    accentClassName: "bg-amber-100 text-amber-700",
  },
  {
    icon: PackageCheck,
    title: "Заберите посылку",
    description: "Получайте обновления и следите за заказом в личном кабинете.",
    surfaceClassName: "bg-emerald-50",
    accentClassName: "bg-emerald-100 text-emerald-700",
  },
];

export function OrderSteps() {
  return (
    <section className="container py-12 md:py-16" aria-labelledby="order-steps-title">
      <div className="grid items-end gap-4 md:grid-cols-[minmax(0,1fr)_minmax(20rem,0.7fr)] md:gap-10">
        <div>
          <SectionLabel>Как это работает</SectionLabel>
          <SectionTitle id="order-steps-title" className="mt-3">
            Путь заказа без сюрпризов
          </SectionTitle>
        </div>
        <SectionSubtitle className="md:justify-self-end">
          Адрес пункта выдачи, стоимость доставки и итоговая сумма видны до оплаты.
        </SectionSubtitle>
      </div>

      <ol className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className={cn(
              "relative flex min-h-48 flex-col overflow-hidden rounded-2xl p-5",
              step.surfaceClassName,
            )}
          >
            <div className="flex items-center justify-between">
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-10 items-center justify-center rounded-xl",
                  step.accentClassName,
                )}
              >
                <step.icon className="size-5" />
              </span>
              <span className="flex items-center gap-2 text-xs font-bold text-foreground/45">
                {String(index + 1).padStart(2, "0")}
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </span>
            </div>
            <h3 className="mt-8 font-heading text-lg font-bold">{step.title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.description}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
