"use client";

import {
  BadgeCheck,
  LogIn,
  Mail,
  Package,
  Phone,
  ShoppingBag,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import {
  getLatestOrder,
  getOrdersTotal,
  getPaidOrdersCount,
  getPreferredCustomerEmail,
  getPreferredCustomerPhone,
  OrderCard,
  useOrdersData,
} from "@/entities/orders";
import { useSession } from "@/entities/session";
import { routes } from "@/shared/constants";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, DataState } from "@/shared/ui";
import { Link } from "@/shared/ui/link";
import { PageTitle, SectionTitle } from "@/shared/ui/typography";

const providerLabels = {
  credentials: "Почта и пароль",
  yandex: "Yandex ID",
} as const;

export function Account() {
  const { user, isPending: isSessionPending } = useSession();
  const orders = useOrdersData({ enabled: Boolean(user) });

  if (isSessionPending) {
    return (
      <section className="container py-10 md:py-14">
        <DataState
          title="Загружаем аккаунт"
          description="Проверяем текущую сессию и данные профиля."
        />
      </section>
    );
  }

  if (!user) {
    return (
      <section className="container py-10 md:py-14">
        <DataState
          title="Войдите в аккаунт"
          description="После входа здесь появятся профиль, контакты и история заказов."
        />
        <div className="mt-5 flex justify-center">
          <Button asChild size="lg">
            <Link href={routes.auth}>
              <LogIn data-icon="inline-start" />
              Войти
            </Link>
          </Button>
        </div>
      </section>
    );
  }

  const accountOrders = orders.isError ? [] : orders.data;
  const latestOrder = getLatestOrder(accountOrders);
  const email = user.email ?? getPreferredCustomerEmail(accountOrders);
  const phone = getPreferredCustomerPhone(accountOrders);
  const ordersTotal = getOrdersTotal(accountOrders);
  const paidOrdersCount = getPaidOrdersCount(accountOrders);
  const userTitle = user.name ?? email ?? user.providerUserId;
  const statsPlaceholder = orders.isError ? "Нет данных" : "...";

  return (
    <section className="container py-8 md:py-12">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="space-y-2">
          <p className="text-sm font-medium tracking-wide text-rose-500 uppercase">Кабинет</p>
          <PageTitle className="max-w-2xl break-words text-foreground">{userTitle}</PageTitle>
          <p className="max-w-2xl text-muted-foreground">
            Заказы, контакты и основная информация аккаунта Artmate.
          </p>
        </div>

        <Button asChild variant="outline">
          <Link href={routes.catalog}>
            <ShoppingBag data-icon="inline-start" />
            Перейти в каталог
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start">
        <aside className="space-y-4 lg:sticky lg:top-24">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserRound className="size-5 text-rose-500" />
                Профиль
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ContactLine icon={Mail} label="Почта" value={email ?? "Не указана"} />
              <ContactLine icon={Phone} label="Телефон" value={phone ?? "Не указан"} />
              <ContactLine icon={BadgeCheck} label="Вход" value={providerLabels[user.provider]} />

              <Badge variant="outline" className="rounded-lg border-emerald-200 text-emerald-700">
                Аккаунт активен
              </Badge>
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <StatCard
              label="Заказов"
              value={orders.isPending || orders.isError ? statsPlaceholder : accountOrders.length}
            />
            <StatCard
              label="Оплачено"
              value={orders.isPending || orders.isError ? statsPlaceholder : paidOrdersCount}
            />
            <StatCard
              label="Сумма"
              value={
                orders.isPending || orders.isError ? statsPlaceholder : formatMoney(ordersTotal)
              }
            />
          </div>
        </aside>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <SectionTitle>Мои заказы</SectionTitle>
              <p className="text-sm text-muted-foreground">
                {getOrdersSectionDescription({
                  count: accountOrders.length,
                  isError: orders.isError,
                  isPending: orders.isPending,
                  latestOrderCreatedAt: latestOrder?.createdAt,
                })}
              </p>
            </div>
          </div>

          {orders.isPending ? (
            <div className="space-y-4">
              <OrderCardSkeleton />
              <OrderCardSkeleton />
            </div>
          ) : orders.isError ? (
            <DataState
              variant="error"
              title="Не удалось загрузить заказы"
              description="Проверьте, что API запущен, и попробуйте обновить страницу."
              className="max-w-none"
            />
          ) : accountOrders.length > 0 ? (
            <div className="space-y-4">
              {accountOrders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          ) : (
            <DataState
              title="Заказов пока нет"
              description="Оформите заказ с почтой аккаунта, и он появится в этом разделе."
              className="max-w-none"
            />
          )}
        </div>
      </div>
    </section>
  );
}

type ContactLineProps = {
  icon: LucideIcon;
  label: string;
  value: string;
};

function ContactLine({ icon: Icon, label, value }: ContactLineProps) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="truncate font-medium">{value}</p>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold">{value}</p>
        </div>
        <span className="flex size-10 items-center justify-center rounded-lg bg-rose-50 text-rose-500">
          <Package className="size-5" />
        </span>
      </CardContent>
    </Card>
  );
}

function OrderCardSkeleton() {
  return (
    <Card aria-hidden="true">
      <CardHeader className="gap-3">
        <div className="h-6 w-44 rounded bg-muted motion-safe:animate-pulse" />
        <div className="h-4 w-64 max-w-full rounded bg-muted motion-safe:animate-pulse" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-28 rounded-lg bg-muted motion-safe:animate-pulse" />
          <div className="h-28 rounded-lg bg-muted motion-safe:animate-pulse" />
        </div>
        <div className="h-16 rounded-lg bg-muted motion-safe:animate-pulse" />
      </CardContent>
    </Card>
  );
}

function getOrdersSectionDescription({
  count,
  isError,
  isPending,
  latestOrderCreatedAt,
}: {
  count: number;
  isError: boolean;
  isPending: boolean;
  latestOrderCreatedAt?: string;
}) {
  if (isPending) {
    return "Загружаем историю заказов.";
  }

  if (isError) {
    return "История заказов временно недоступна.";
  }

  if (count === 0) {
    return "История заказов пуста.";
  }

  if (!latestOrderCreatedAt) {
    return `${count} ${getOrdersWord(count)} в аккаунте.`;
  }

  return `${count} ${getOrdersWord(count)} в аккаунте, последний от ${formatDate(latestOrderCreatedAt)}.`;
}

function formatMoney(value: number) {
  return `${value.toLocaleString("ru-RU")} ₽`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function getOrdersWord(count: number) {
  const lastTwoDigits = count % 100;
  const lastDigit = count % 10;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return "заказов";
  }

  if (lastDigit === 1) {
    return "заказ";
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return "заказа";
  }

  return "заказов";
}
