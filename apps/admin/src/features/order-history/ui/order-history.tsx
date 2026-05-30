"use client";

import {
  CalendarDays,
  CreditCard,
  History,
  Mail,
  MessageSquare,
  Package,
  Phone,
  Truck,
} from "lucide-react";

import { useOrder, type AdminOrder, type OrderStatus } from "@/entities/orders";
import {
  Badge,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui";

type OrderHistoryProps = {
  readonly orderId: string;
};

const adminOrderStatusLabels: Record<OrderStatus, string> = {
  new: "Новые",
  in_progress: "В работе",
  waiting_payment: "Ожидают оплаты",
  paid: "Оплачено",
  delivering: "Доставляются",
  completed: "Завершены",
  cancelled: "Отменены",
};

export function OrderHistory({ orderId }: OrderHistoryProps) {
  const { isError, isPending, order } = useOrder(orderId);

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Не удалось загрузить заказ</CardTitle>
          <CardDescription>
            Перезагрузите страницу и повторите действие.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isPending || !order) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Загрузка заказа</CardTitle>
          <CardDescription>
            Получаем историю, комментарии и состав заказа.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const history = [...order.history].reverse();
  const comments = [...order.adminComments].reverse();

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="space-y-4">
        <OrderSummary order={order} />
        <HistoryTimeline history={history} />
      </div>

      <aside className="space-y-4">
        <CustomerPanel order={order} />
        <ItemsPanel order={order} />
        <CommentsPanel comments={comments} />
      </aside>
    </div>
  );
}

function OrderSummary({ order }: { readonly order: AdminOrder }) {
  return (
    <section className="rounded-lg border bg-background p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              {adminOrderStatusLabels[order.status]}
            </Badge>
            <Badge variant="outline">
              <CreditCard data-icon="inline-start" aria-hidden="true" />
              {getPaymentStatusLabel(order.payment.status)}
            </Badge>
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-normal">
            Заказ {order.id}
          </h2>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarDays className="size-4" aria-hidden="true" />
            Создан {formatDateTime(order.createdAt)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <Metric label="Товары" value={`${order.itemsCount} шт.`} />
          <Metric label="Итого" value={formatMoney(order.total)} />
        </div>
      </div>

      {order.comment ? (
        <div className="mt-4 rounded-lg border bg-muted/35 p-3 text-sm">
          <p className="font-medium">Комментарий клиента</p>
          <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
            {order.comment}
          </p>
        </div>
      ) : null}
    </section>
  );
}

function getPaymentStatusLabel(status: AdminOrder["payment"]["status"]) {
  switch (status) {
    case "failed":
      return "Оплата не прошла";
    case "paid":
      return "Оплачен";
    case "pending":
      return "Ожидает оплаты";
  }
}

function HistoryTimeline({
  history,
}: {
  readonly history: readonly AdminOrder["history"][number][];
}) {
  return (
    <section className="rounded-lg border bg-background">
      <div className="flex items-center justify-between gap-3 border-b p-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <History className="size-5" aria-hidden="true" />
            Полная история
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Все события заказа, новые сверху.
          </p>
        </div>
        <Badge variant="outline">{history.length}</Badge>
      </div>

      {history.length > 0 ? (
        <ol className="divide-y">
          {history.map((event) => (
            <li className="p-4" key={event.id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium">{getHistoryEventTitle(event)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {getHistoryEventText(event)}
                  </p>
                </div>
                <div className="shrink-0 text-sm text-muted-foreground sm:text-right">
                  <p>{formatDateTime(event.createdAt)}</p>
                  <p>
                    {event.authorName ?? getHistoryAuthorLabel(event.eventType)}
                  </p>
                </div>
              </div>

              <pre className="mt-3 overflow-x-auto rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
                {formatJson(event.payload)}
              </pre>
            </li>
          ))}
        </ol>
      ) : (
        <p className="p-4 text-sm text-muted-foreground">Истории пока нет.</p>
      )}
    </section>
  );
}

function CustomerPanel({ order }: { readonly order: AdminOrder }) {
  return (
    <section className="rounded-lg border bg-background p-4">
      <h2 className="text-base font-semibold">Клиент</h2>
      <div className="mt-3 space-y-2 text-sm">
        <p className="font-medium">{order.customer.name}</p>
        <p className="flex items-center gap-2 text-muted-foreground">
          <Phone className="size-4" aria-hidden="true" />
          {order.customer.phone}
        </p>
        <p className="flex items-center gap-2 break-all text-muted-foreground">
          <Mail className="size-4 shrink-0" aria-hidden="true" />
          {order.customer.email}
        </p>
      </div>

      <div className="mt-4 rounded-lg border bg-muted/35 p-3 text-sm">
        <p className="flex items-center gap-2 font-medium">
          <Truck className="size-4" aria-hidden="true" />
          Доставка
        </p>
        <p className="mt-1 text-muted-foreground">
          {order.delivery.pickupPoint.address}
        </p>
      </div>

      {order.delivery.provider === "cdek" ? (
        <CdekShipmentPanel order={order} />
      ) : null}
    </section>
  );
}

function CdekShipmentPanel({ order }: { readonly order: AdminOrder }) {
  const shipment = order.shipments.find((item) => item.provider === "cdek");

  return (
    <div className="mt-3 rounded-lg border bg-muted/35 p-3 text-sm">
      <p className="flex items-center gap-2 font-medium">
        <Truck className="size-4" aria-hidden="true" />
        Накладная CDEK
      </p>
      {shipment ? (
        <div className="mt-2 space-y-1 text-muted-foreground">
          <p>{getShipmentStatusLabel(shipment)}</p>
          {shipment.externalNumber ? (
            <p>Номер: {shipment.externalNumber}</p>
          ) : null}
          {shipment.externalUuid ? (
            <p className="break-all">UUID: {shipment.externalUuid}</p>
          ) : null}
          {shipment.errorMessage ? (
            <p className="text-destructive">{shipment.errorMessage}</p>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 text-muted-foreground">Еще не создавалась.</p>
      )}
    </div>
  );
}

function ItemsPanel({ order }: { readonly order: AdminOrder }) {
  return (
    <section className="rounded-lg border bg-background p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Package className="size-4" aria-hidden="true" />
          Состав
        </h2>
        <Badge variant="outline">{order.items.length}</Badge>
      </div>

      <div className="mt-3 space-y-3">
        {order.items.map((item) => (
          <div className="rounded-lg border p-3 text-sm" key={item.id}>
            <p className="font-medium">{item.title}</p>
            <p className="mt-1 text-muted-foreground">
              {item.quantity} шт. x {formatMoney(item.price)} ={" "}
              {formatMoney(item.lineTotal)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function CommentsPanel({
  comments,
}: {
  readonly comments: readonly AdminOrder["adminComments"][number][];
}) {
  return (
    <section className="rounded-lg border bg-background p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <MessageSquare className="size-4" aria-hidden="true" />
          Комментарии
        </h2>
        <Badge variant="outline">{comments.length}</Badge>
      </div>

      {comments.length > 0 ? (
        <div className="mt-3 space-y-3">
          {comments.map((comment) => (
            <div className="rounded-lg border p-3 text-sm" key={comment.id}>
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="truncate">
                  {comment.authorName ?? "Администратор"}
                </span>
                <span className="shrink-0">
                  {formatDateTime(comment.createdAt)}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap">{comment.body}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-lg border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">
          Комментариев пока нет.
        </p>
      )}
    </section>
  );
}

function Metric({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="min-w-28 rounded-lg border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

function getHistoryEventTitle(event: AdminOrder["history"][number]) {
  if (event.eventType === "status_changed") {
    return "Статус изменен";
  }

  if (event.eventType === "comment_created") {
    return "Комментарий добавлен";
  }

  return event.eventType;
}

function getHistoryEventText(event: AdminOrder["history"][number]) {
  if (event.eventType === "status_changed") {
    const fromStatus = getStatusLabel(event.payload.fromStatus);
    const toStatus = getStatusLabel(event.payload.toStatus);

    if (!toStatus) {
      return "Статус заказа изменен.";
    }

    return fromStatus ? `${fromStatus} -> ${toStatus}` : `Статус: ${toStatus}`;
  }

  if (event.eventType === "comment_created") {
    return "Администратор оставил внутренний комментарий.";
  }

  return "Системное событие заказа.";
}

function getHistoryAuthorLabel(eventType: string) {
  return eventType === "status_changed" ? "Система" : "Администратор";
}

function getStatusLabel(value: unknown) {
  if (typeof value !== "string" || !(value in adminOrderStatusLabels)) {
    return undefined;
  }

  return adminOrderStatusLabels[value as OrderStatus];
}

function getShipmentStatusLabel(shipment: AdminOrder["shipments"][number]) {
  if (shipment.errorMessage) {
    return "Ошибка создания";
  }

  if (shipment.statusName) {
    return shipment.statusName;
  }

  if (shipment.statusCode) {
    return shipment.statusCode;
  }

  if (shipment.requestState === "SUCCESSFUL") {
    return "Создана";
  }

  if (shipment.requestState === "INVALID") {
    return "Отклонена CDEK";
  }

  if (shipment.requestState === "CREATING") {
    return "Создается";
  }

  return shipment.requestState ?? "Принята CDEK";
}

function formatJson(value: Record<string, unknown>) {
  return JSON.stringify(value, null, 2);
}

function formatMoney(value: number) {
  return `${value.toLocaleString("ru-RU")} ₽`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
