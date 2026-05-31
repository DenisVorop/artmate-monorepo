"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Bell,
  ExternalLink,
  LogIn,
  Mail,
  MessageCircle,
  Phone,
  ShoppingBag,
  Unlink,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useForm } from "react-hook-form";

import {
  getLatestOrder,
  getPreferredCustomerEmail,
  OrderCard,
  useOrdersData,
} from "@/entities/orders";
import {
  getSessionUserDisplayName,
  useSession,
  useTelegramLinkStatus,
} from "@/entities/session";
import { routes } from "@/shared/constants";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataState,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
} from "@/shared/ui";
import { Link } from "@/shared/ui/link";
import { PageTitle, SectionTitle } from "@/shared/ui/typography";

import {
  telegramLinkFormSchema,
  toConfirmTelegramLinkInput,
  type TelegramLinkFormValues,
} from "../lib";
import { useConfirmTelegramLink, useUnlinkTelegram } from "../model";

export function Account() {
  const { user, isPending: isSessionPending } = useSession();
  const orders = useOrdersData({ enabled: Boolean(user) });
  const telegramLink = useTelegramLinkStatus({ enabled: Boolean(user) });

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
  const userTitle = getSessionUserDisplayName(user);

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
              <ContactLine icon={Phone} label="Телефон" value={user.phone ?? "Не указан"} />
            </CardContent>
          </Card>

          <TelegramLinkCard telegramLink={telegramLink} />
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

type TelegramLinkCardProps = {
  telegramLink: ReturnType<typeof useTelegramLinkStatus>;
};

function TelegramLinkCard({ telegramLink }: TelegramLinkCardProps) {
  const [formError, setFormError] = useState<string>();
  const [successMessage, setSuccessMessage] = useState<string>();
  const [isUnlinkDialogOpen, setIsUnlinkDialogOpen] = useState(false);
  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<TelegramLinkFormValues>({
    defaultValues: {
      code: "",
    },
    resolver: zodResolver(telegramLinkFormSchema),
  });
  const confirmTelegramLink = useConfirmTelegramLink({
    onSuccess: () => {
      reset();
      setSuccessMessage("Telegram привязан к аккаунту.");
    },
  });
  const unlinkTelegram = useUnlinkTelegram({
    onSuccess: () => {
      reset();
      setFormError(undefined);
      setSuccessMessage("Telegram отвязан от аккаунта.");
      setIsUnlinkDialogOpen(false);
    },
  });
  const account = telegramLink.data?.account;
  const isLinked = Boolean(telegramLink.data?.linked && account);

  async function onSubmit(values: TelegramLinkFormValues) {
    setFormError(undefined);
    setSuccessMessage(undefined);

    try {
      await confirmTelegramLink.mutate(toConfirmTelegramLinkInput(values));
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Не удалось привязать Telegram");
    }
  }

  async function handleUnlink() {
    setFormError(undefined);
    setSuccessMessage(undefined);

    try {
      await unlinkTelegram.mutate();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Не удалось отвязать Telegram");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="size-5 text-rose-500" />
          Telegram
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
          <Bell className="mt-0.5 size-4 shrink-0 text-rose-500" />
          <p>
            Привяжите Telegram, чтобы получать уведомления о заказах, событиях и важных обновлениях
            Artmate.
          </p>
        </div>

        {telegramLink.isPending ? (
          <div className="space-y-3" aria-hidden="true">
            <div className="h-10 rounded bg-muted motion-safe:animate-pulse" />
            <div className="h-10 rounded bg-muted motion-safe:animate-pulse" />
          </div>
        ) : telegramLink.isError ? (
          <p className="text-sm text-destructive">Не удалось загрузить статус Telegram.</p>
        ) : isLinked && account ? (
          <div className="space-y-3">
            <Badge variant="secondary" className="w-fit">
              Привязан
            </Badge>
            <ContactLine icon={Phone} label="Телефон Telegram" value={account.phone} />
            <ContactLine
              icon={UserRound}
              label="Аккаунт Telegram"
              value={formatTelegramAccountName(account)}
            />
            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
            {successMessage ? <p className="text-sm text-emerald-600">{successMessage}</p> : null}
            <Dialog open={isUnlinkDialogOpen} onOpenChange={setIsUnlinkDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  type="button"
                  variant="destructive"
                  className="w-full"
                  disabled={unlinkTelegram.isPending}
                >
                  <Unlink data-icon="inline-start" />
                  Отключить Telegram
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Отключить Telegram?</DialogTitle>
                  <DialogDescription>
                    Аккаунт Telegram перестанет получать уведомления Artmate. Подключить его заново
                    можно будет в этом же разделе.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline" disabled={unlinkTelegram.isPending}>
                      Отмена
                    </Button>
                  </DialogClose>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={unlinkTelegram.isPending}
                    onClick={() => {
                      void handleUnlink();
                    }}
                  >
                    Отключить
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        ) : (
          <div className="space-y-4">
            {telegramLink.data?.botUrl ? (
              <Button asChild className="w-full">
                <a href={telegramLink.data.botUrl} target="_blank" rel="noreferrer">
                  <ExternalLink data-icon="inline-start" />
                  Открыть бота
                </a>
              </Button>
            ) : (
              <Button className="w-full" disabled>
                Бот не настроен
              </Button>
            )}

            <form
              className="space-y-3"
              onSubmit={(event) => {
                void handleSubmit(onSubmit)(event);
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="telegram-link-code">Код из Telegram</Label>
                <Input
                  id="telegram-link-code"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  autoComplete="one-time-code"
                  aria-invalid={Boolean(errors.code)}
                  {...register("code")}
                />
                {errors.code?.message ? (
                  <p className="text-sm text-destructive">{errors.code.message}</p>
                ) : null}
              </div>

              {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
              {successMessage ? <p className="text-sm text-emerald-600">{successMessage}</p> : null}

              <Button type="submit" className="w-full" disabled={confirmTelegramLink.isPending}>
                Подтвердить код
              </Button>
            </form>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatTelegramAccountName(account: {
  firstName?: string;
  lastName?: string;
  username?: string;
}) {
  if (account.username) {
    return `@${account.username}`;
  }

  const fullName = [account.firstName, account.lastName].filter(Boolean).join(" ");

  return fullName || "Привязан";
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
