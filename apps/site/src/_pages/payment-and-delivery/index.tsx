import { CreditCard, MapPin, ReceiptText, RotateCcw, ShieldCheck, Truck } from "lucide-react";

import { companyDetails, routes } from "@/shared/constants";
import { Button, Separator } from "@/shared/ui";
import { Link } from "@/shared/ui/link";
import { PageTitle, SectionTitle } from "@/shared/ui/typography";

const steps = [
  {
    title: "Выберите товары",
    description: "Добавьте раскраски в корзину и проверьте состав заказа.",
  },
  {
    title: "Укажите контакты",
    description: "Введите имя, телефон, email и выберите доступный пункт выдачи Ozon.",
  },
  {
    title: "Перейдите к оплате",
    description: "После подтверждения заказа откроется защищенная страница Ozon Pay.",
  },
  {
    title: "Получите заказ",
    description: "Мы передадим заказ в доставку Ozon и отправим информацию о статусе.",
  },
];

const highlights = [
  {
    icon: CreditCard,
    title: "Оплата",
    description:
      "Доступна онлайн-оплата банковской картой и другими способами, которые поддерживает Ozon Pay на платежной странице.",
  },
  {
    icon: ShieldCheck,
    title: "Безопасность",
    description:
      "Данные банковских карт вводятся на стороне платежного сервиса. Artmate не хранит реквизиты карт.",
  },
  {
    icon: ReceiptText,
    title: "Чек",
    description:
      "После успешной оплаты покупатель получает электронный чек и подтверждение операции на указанный email.",
  },
  {
    icon: MapPin,
    title: "ПВЗ Ozon",
    description:
      "Доставка оформляется в выбранный пункт выдачи Ozon. Доступные адреса показываются при оформлении.",
  },
  {
    icon: Truck,
    title: "Сроки",
    description:
      "Ориентировочный срок доставки зависит от региона и выбранного пункта выдачи, он уточняется при оформлении заказа.",
  },
  {
    icon: RotateCcw,
    title: "Возврат",
    description:
      "Возврат денежных средств выполняется на тот же способ оплаты после проверки обращения и оснований возврата.",
  },
];

export function PaymentAndDeliveryPage() {
  return (
    <main className="bg-background">
      <section className="container py-10 md:py-14">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(24rem,1.05fr)] lg:items-start">
          <div className="space-y-5">
            <p className="text-sm font-medium tracking-wide text-rose-500 uppercase">
              Оплата и доставка
            </p>
            <PageTitle className="max-w-3xl text-foreground">
              Заказ оплачивается через Ozon Pay и доставляется в ПВЗ Ozon
            </PageTitle>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href={routes.catalog}>Перейти в каталог</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href={routes.legal.returnPolicy}>Правила возврата</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 p-5">
            <h2 className="font-display text-xl leading-tight font-semibold tracking-normal">
              Реквизиты продавца
            </h2>
            <dl className="mt-5 grid gap-3 text-sm">
              <Detail label="Продавец" value={companyDetails.legalName} />
              <Detail label="ИНН" value={companyDetails.inn} />
              <Detail
                label={companyDetails.registrationNumberLabel}
                value={companyDetails.registrationNumber}
              />
              <Detail label="Юридический адрес" value={companyDetails.legalAddress} />
              <Detail label="Страна регистрации" value={companyDetails.registrationCountry} />
              <Detail label="Телефон" value={companyDetails.supportPhone} />
              <Detail label="Email" value={companyDetails.supportEmail} />
            </dl>
          </div>
        </div>
      </section>

      <section className="border-y bg-muted/30 py-10 md:py-14" aria-labelledby="payment-steps">
        <div className="container">
          <SectionTitle id="payment-steps">Как проходит заказ</SectionTitle>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {steps.map((step, index) => (
              <div key={step.title} className="rounded-lg border bg-background p-5">
                <span className="flex size-8 items-center justify-center rounded-full bg-rose-100 text-sm font-semibold text-rose-600">
                  {index + 1}
                </span>
                <h3 className="mt-4 font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container py-10 md:py-14" aria-labelledby="payment-details">
        <div className="max-w-3xl space-y-3">
          <SectionTitle id="payment-details">Условия оплаты и предоставления услуг</SectionTitle>
          <p className="leading-7 text-muted-foreground">
            После подтверждения заказа покупатель будет перенаправлен на защищенную платежную
            страницу {companyDetails.paymentProvider}. Оплата считается завершенной после получения
            успешного статуса от платежного сервиса.
          </p>
          <p className="leading-7 text-muted-foreground">
            Заказ передается в сборку после успешной оплаты. Если операция выглядит подозрительной
            или требует дополнительной проверки, обработка заказа может быть приостановлена до
            подтверждения данных покупателя.
          </p>
        </div>

        <Separator className="my-8" />

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {highlights.map((item) => (
            <div key={item.title} className="rounded-lg border p-5">
              <item.icon className="size-5 text-rose-500" />
              <h3 className="mt-4 font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[10rem_1fr]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}

export { metadata } from "./metadata";
