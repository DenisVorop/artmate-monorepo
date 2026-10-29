import Link from "next/link";
import { ArrowUpRight, CreditCard, MessageCircle, Truck } from "lucide-react";
import { routes } from "@/shared/constants";

const items = [
  {
    Icon: Truck,
    title: "Доставка в пункт выдачи",
    text: "Выберите СДЭК или Ozon при оформлении заказа.",
    href: routes.paymentAndDelivery,
  },
  {
    Icon: CreditCard,
    title: "Оплата на сайте",
    text: "Доступные способы — при оформлении заказа.",
    href: routes.paymentAndDelivery,
  },
  {
    Icon: MessageCircle,
    title: "Поможем с выбором",
    text: "Ответим на вопросы об альбомах и маркерах.",
    href: routes.contacts,
  },
];

export function ShoppingInfo() {
  return (
    <section className="container" aria-label="Покупки в Artmate">
      <ul className="grid gap-5 md:grid-cols-3 md:gap-8">
        {items.map(({ Icon, title, text, href }) => (
          <li key={title}>
            <Link
              href={href}
              className="group flex gap-3 rounded-lg py-2 focus-visible:outline-2 focus-visible:outline-rose-400"
            >
              <Icon
                className="mt-0.5 size-5 shrink-0 text-rose-500"
                strokeWidth={1.5}
                aria-hidden="true"
              />
              <div>
                <h2 className="flex items-center gap-2 text-sm font-bold">
                  {title}
                  <ArrowUpRight
                    className="size-3.5 text-stone-400 group-hover:text-rose-500"
                    aria-hidden="true"
                  />
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-stone-500">{text}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
