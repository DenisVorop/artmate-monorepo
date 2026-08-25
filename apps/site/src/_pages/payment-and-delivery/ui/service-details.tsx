import { CircleUserRound, CreditCard, ReceiptText, ShieldCheck, Truck } from "lucide-react";

import { cn } from "@/shared/lib";
import { Card } from "@/shared/ui";
import { SectionLabel, SectionSubtitle, SectionTitle } from "@/shared/ui/typography";

const services = [
  {
    icon: Truck,
    label: "Доставка",
    title: "В удобный пункт выдачи",
    description:
      "Выберите СДЭК или доступную для состава корзины доставку Ozon, затем найдите ПВЗ на карте.",
    iconClassName: "bg-emerald-100 text-emerald-700",
    providers: [
      { name: "СДЭК", className: "bg-emerald-50 text-emerald-700" },
      { name: "Ozon", className: "bg-sky-50 text-sky-700" },
    ],
    facts: [
      {
        label: "География",
        description: "По России, где служба показывает доступный пункт выдачи.",
      },
      {
        label: "Стоимость и срок",
        description: "Стоимость — после выбора ПВЗ; срок — если его передает служба.",
      },
    ],
  },
  {
    icon: CreditCard,
    label: "Оплата",
    title: "На защищенной странице",
    description: "После подтверждения заказа откроется платежная страница выбранного сервиса.",
    iconClassName: "bg-amber-100 text-amber-700",
    providers: [
      { name: "T-Bank", className: "bg-yellow-100 text-stone-900" },
      { name: "Ozon Pay", className: "bg-sky-50 text-sky-700" },
    ],
    facts: [
      {
        label: "Данные карты",
        description: "Artmate не обрабатывает и не хранит платежные данные.",
      },
      {
        label: "Подтверждение",
        description: "Электронный чек придет на указанный email.",
      },
    ],
  },
];

const trustItems = [
  {
    icon: ShieldCheck,
    title: "Защищенная оплата",
    description: "На стороне платежного сервиса",
  },
  {
    icon: ReceiptText,
    title: "Электронный чек",
    description: "После успешной операции",
  },
  {
    icon: CircleUserRound,
    title: "Статус заказа",
    description: "В личном кабинете Artmate",
  },
];

export function ServiceDetails() {
  return (
    <section
      className="border-y bg-stone-50/70 py-12 md:py-16"
      aria-labelledby="service-details-title"
    >
      <div className="container">
        <div className="grid items-end gap-4 md:grid-cols-[minmax(0,1fr)_minmax(20rem,0.7fr)] md:gap-10">
          <div>
            <SectionLabel color="emerald" className="text-emerald-700">
              Выбор за вами
            </SectionLabel>
            <SectionTitle id="service-details-title" className="mt-3">
              Доставка и оплата
            </SectionTitle>
          </div>
          <SectionSubtitle className="md:justify-self-end">
            Способ оплаты не зависит от выбранной службы доставки.
          </SectionSubtitle>
        </div>

        <div className="mt-7 grid gap-4 lg:grid-cols-2">
          {services.map((service) => (
            <Card key={service.label} className="gap-0 rounded-3xl py-0 shadow-none">
              <article className="p-6 md:p-7">
                <div className="flex items-start justify-between gap-4">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex size-11 shrink-0 items-center justify-center rounded-2xl",
                      service.iconClassName,
                    )}
                  >
                    <service.icon className="size-5" />
                  </span>
                  <div className="flex flex-wrap justify-end gap-2">
                    {service.providers.map((provider) => (
                      <span
                        key={provider.name}
                        className={cn(
                          "rounded-lg px-3 py-1.5 text-xs font-extrabold",
                          provider.className,
                        )}
                      >
                        {provider.name}
                      </span>
                    ))}
                  </div>
                </div>

                <p className="mt-7 text-xs font-bold tracking-widest text-muted-foreground uppercase">
                  {service.label}
                </p>
                <h3 className="mt-2 font-heading text-xl font-bold">{service.title}</h3>
                <p className="mt-3 max-w-xl leading-7 text-muted-foreground">
                  {service.description}
                </p>

                <dl className="mt-6 grid gap-3 sm:grid-cols-2">
                  {service.facts.map((fact) => (
                    <div key={fact.label} className="rounded-xl bg-muted/60 p-4">
                      <dt className="text-sm font-bold text-foreground">{fact.label}</dt>
                      <dd className="mt-1 text-sm leading-5 text-muted-foreground">
                        {fact.description}
                      </dd>
                    </div>
                  ))}
                </dl>
              </article>
            </Card>
          ))}
        </div>

        <ul className="mt-4 grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-3">
          {trustItems.map((item) => (
            <li key={item.title} className="flex items-center gap-3 bg-background p-4 sm:p-5">
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600"
              >
                <item.icon className="size-5" />
              </span>
              <span>
                <span className="block text-sm font-bold">{item.title}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {item.description}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
