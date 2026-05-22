"use client";

import type { DragEvent } from "react";
import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Ban,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  GripVertical,
  History,
  Mail,
  MessageSquare,
  PackageCheck,
  Phone,
  SendHorizontal,
} from "lucide-react";
import { useForm } from "react-hook-form";

import {
  getOrdersByStatus,
  getOrdersTotal,
  useOrders,
  type AdminOrder,
  type OrderStatus,
} from "@/entities/orders";
import { routes } from "@/shared/constants";
import { cn } from "@/shared/lib/utils";
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  Textarea,
} from "@/shared/ui";

import {
  orderAdminCommentFormSchema,
  orderCrmColumns,
  orderCrmStatusLabels,
  type OrderAdminCommentFormValues,
  type OrderCrmColumn,
} from "../lib";
import { useCreateOrderComment, useUpdateOrderCrmStatus } from "../model";

export function OrdersCrm() {
  const { isError, isPending, orders } = useOrders();
  const [draggedOrderId, setDraggedOrderId] = useState<string | null>(null);
  const { isPending: isStatusPending, mutate: updateOrderStatus } =
    useUpdateOrderCrmStatus();
  const draggedOrder = useMemo(
    () => orders.find((order) => order.id === draggedOrderId),
    [draggedOrderId, orders],
  );

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Не удалось загрузить заявки</CardTitle>
          <CardDescription>Перезагрузите страницу и повторите действие.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isPending) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Загрузка CRM</CardTitle>
          <CardDescription>Получаем заказы и комментарии.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const handleDrop = (status: OrderStatus) => {
    if (!draggedOrder || draggedOrder.status === status) {
      setDraggedOrderId(null);

      return;
    }

    updateOrderStatus({
      status,
      orderId: draggedOrder.id,
    });
    setDraggedOrderId(null);
  };

  return (
    <div className="space-y-4">
      <CrmSummary orders={orders} />

      <div className="grid auto-cols-[minmax(18rem,22rem)] grid-flow-col gap-4 overflow-x-auto pb-3">
        {orderCrmColumns.map((column) => (
          <OrdersColumn
            column={column}
            draggedOrderId={draggedOrderId}
            isStatusPending={isStatusPending}
            key={column.status}
            onDrop={handleDrop}
            onDragStart={setDraggedOrderId}
            orders={getOrdersByStatus(orders, column.status)}
          />
        ))}
      </div>
    </div>
  );
}

function CrmSummary({ orders }: { readonly orders: readonly AdminOrder[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryItem label="Заявок" value={orders.length.toLocaleString("ru-RU")} />
      <SummaryItem label="В работе" value={getColumnCount(orders, "in_progress")} />
      <SummaryItem label="Завершены" value={getCompletedOrdersCount(orders)} />
      <SummaryItem label="Сумма" value={formatMoney(getOrdersTotal(orders))} />
    </div>
  );
}

function SummaryItem({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string | number;
}) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function OrdersColumn({
  column,
  draggedOrderId,
  isStatusPending,
  onDragStart,
  onDrop,
  orders,
}: {
  readonly column: OrderCrmColumn;
  readonly draggedOrderId: string | null;
  readonly isStatusPending: boolean;
  readonly onDragStart: (orderId: string | null) => void;
  readonly onDrop: (status: OrderStatus) => void;
  readonly orders: readonly AdminOrder[];
}) {
  const isDropTarget = Boolean(draggedOrderId);

  return (
    <section
      aria-label={column.title}
      className={cn(
        "flex max-h-[calc(100vh-15rem)] min-h-[32rem] flex-col rounded-lg border bg-muted/35 transition-colors",
        isDropTarget ? "border-primary/30 bg-muted/70" : "border-border",
      )}
      onDragOver={(event) => event.preventDefault()}
      onDrop={() => onDrop(column.status)}
    >
      <header className="border-b bg-background/70 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={cn("size-2 rounded-full", column.markerClassName)}
                aria-hidden="true"
              />
              <h2 className="truncate text-sm font-semibold">{column.title}</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {column.description}
            </p>
          </div>
          <Badge variant="secondary">{orders.length}</Badge>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {orders.length > 0 ? (
          orders.map((order) => (
            <OrderCard
              isStatusPending={isStatusPending}
              key={order.id}
              onDragStart={onDragStart}
              order={order}
            />
          ))
        ) : (
          <div className="grid min-h-32 place-items-center rounded-lg border border-dashed bg-background/60 px-4 text-center text-sm text-muted-foreground">
            Нет заявок
          </div>
        )}
      </div>
    </section>
  );
}

function OrderCard({
  isStatusPending,
  onDragStart,
  order,
}: {
  readonly isStatusPending: boolean;
  readonly onDragStart: (orderId: string | null) => void;
  readonly order: AdminOrder;
}) {
  const { isPending: isCommentPending, mutate: createComment } =
    useCreateOrderComment();
  const { isPending: isMovePending, mutate: updateOrderStatus } =
    useUpdateOrderCrmStatus();
  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<OrderAdminCommentFormValues>({
    defaultValues: {
      body: "",
    },
    resolver: zodResolver(orderAdminCommentFormSchema),
  });
  const visibleComments = order.adminComments.slice(-3).reverse();
  const visibleHistory = order.history.slice(-4).reverse();
  const submitComment = handleSubmit((values) => {
    createComment(
      {
        body: values.body,
        orderId: order.id,
      },
      {
        onSuccess: () => reset(),
      },
    );
  });

  return (
    <article
      className="rounded-lg border bg-background text-sm shadow-sm transition-shadow hover:shadow-md"
      draggable={!isStatusPending}
      onDragEnd={() => onDragStart(null)}
      onDragStart={(event) => handleDragStart(event, order, onDragStart)}
    >
      <div className="space-y-3 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <GripVertical
                className="size-4 shrink-0 cursor-grab text-muted-foreground"
                aria-hidden="true"
              />
              <p className="truncate font-semibold">Заказ {order.id}</p>
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays className="size-3.5" aria-hidden="true" />
              {formatDateTime(order.createdAt)}
            </p>
          </div>
          <PaymentBadge order={order} />
        </div>

        <div className="space-y-1">
          <p className="font-medium">{order.customer.name}</p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Phone className="size-3.5" aria-hidden="true" />
            {order.customer.phone}
          </p>
          <p className="flex items-center gap-1.5 break-all text-xs text-muted-foreground">
            <Mail className="size-3.5 shrink-0" aria-hidden="true" />
            {order.customer.email}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Metric label="Товары" value={`${order.itemsCount} шт.`} />
          <Metric label="Итого" value={formatMoney(order.total)} />
        </div>

        {order.comment ? (
          <div className="rounded-lg border bg-muted/40 p-2 text-xs">
            <p className="font-medium">Комментарий клиента</p>
            <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
              {order.comment}
            </p>
          </div>
        ) : null}

        <MoveControls
          disabled={isMovePending || isStatusPending}
          order={order}
          onMove={(status) =>
            updateOrderStatus({
              orderId: order.id,
              status,
            })
          }
        />
      </div>

      <div className="space-y-3 border-t bg-muted/25 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 font-medium">
            <MessageSquare className="size-4" aria-hidden="true" />
            Комментарии
          </p>
          <Badge variant="outline">{order.adminComments.length}</Badge>
        </div>

        {visibleComments.length > 0 ? (
          <div className="space-y-2">
            {visibleComments.map((comment) => (
              <div
                className="rounded-lg border bg-background p-2 text-xs"
                key={comment.id}
              >
                <div className="flex items-center justify-between gap-2 text-muted-foreground">
                  <span className="truncate">
                    {comment.authorName ?? "Администратор"}
                  </span>
                  <span className="shrink-0">
                    {formatDateTime(comment.createdAt)}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap">{comment.body}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed bg-background/70 px-3 py-2 text-xs text-muted-foreground">
            Комментариев пока нет
          </p>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 font-medium">
              <History className="size-4" aria-hidden="true" />
              История
            </p>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{order.history.length}</Badge>
              <Button asChild size="sm" variant="outline">
                <a href={routes.order(order.id)}>
                  <ExternalLink data-icon="inline-start" aria-hidden="true" />
                  Вся
                </a>
              </Button>
            </div>
          </div>

          {visibleHistory.length > 0 ? (
            <div className="space-y-2">
              {visibleHistory.map((event) => (
                <div
                  className="rounded-lg border bg-background p-2 text-xs"
                  key={event.id}
                >
                  <div className="flex items-center justify-between gap-2 text-muted-foreground">
                    <span className="truncate">
                      {event.authorName ?? getHistoryAuthorLabel(event.eventType)}
                    </span>
                    <span className="shrink-0">
                      {formatDateTime(event.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1">{getHistoryEventText(event)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed bg-background/70 px-3 py-2 text-xs text-muted-foreground">
              Изменений пока нет
            </p>
          )}
        </div>

        <form className="space-y-2" onSubmit={submitComment}>
          <Textarea
            aria-invalid={Boolean(errors.body)}
            aria-label={`Комментарий к заказу ${order.id}`}
            placeholder="Комментарий администратора"
            rows={3}
            {...register("body")}
          />
          {errors.body ? (
            <p className="text-xs text-destructive">{errors.body.message}</p>
          ) : null}
          <Button
            className="w-full"
            disabled={isCommentPending}
            size="sm"
            type="submit"
          >
            <SendHorizontal data-icon="inline-start" aria-hidden="true" />
            Добавить
          </Button>
        </form>
      </div>
    </article>
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
    <div className="rounded-lg border bg-muted/30 p-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

function PaymentBadge({ order }: { readonly order: AdminOrder }) {
  const isPaid = order.payment.status === "paid";

  return (
    <Badge
      className={cn(
        "rounded-lg",
        isPaid
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-amber-200 bg-amber-50 text-amber-700",
      )}
      variant="outline"
    >
      <PackageCheck data-icon="inline-start" aria-hidden="true" />
      {isPaid ? "Оплачен" : "Оплата"}
    </Badge>
  );
}

function MoveControls({
  disabled,
  onMove,
  order,
}: {
  readonly disabled: boolean;
  readonly onMove: (status: OrderStatus) => void;
  readonly order: AdminOrder;
}) {
  const columnIndex = orderCrmColumns.findIndex(
    (column) => column.status === order.status,
  );
  const previousColumn = orderCrmColumns[columnIndex - 1];
  const nextColumn = orderCrmColumns[columnIndex + 1];
  const canCloseAsIrrelevant = order.status !== "cancelled";

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
        <Button
          aria-label={
            previousColumn
              ? `Переместить в ${previousColumn.title}`
              : "Предыдущей колонки нет"
          }
          disabled={disabled || !previousColumn}
          onClick={() => previousColumn && onMove(previousColumn.status)}
          size="icon-sm"
          type="button"
          variant="outline"
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <div className="min-w-0 rounded-lg bg-muted px-2 py-1 text-center text-xs font-medium">
          <span className="truncate">{orderCrmStatusLabels[order.status]}</span>
        </div>
        <Button
          aria-label={
            nextColumn ? `Переместить в ${nextColumn.title}` : "Следующей колонки нет"
          }
          disabled={disabled || !nextColumn}
          onClick={() => nextColumn && onMove(nextColumn.status)}
          size="icon-sm"
          type="button"
          variant="outline"
        >
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>

      {canCloseAsIrrelevant ? (
        <Button
          className="w-full"
          disabled={disabled}
          onClick={() => onMove("cancelled")}
          size="sm"
          type="button"
          variant="destructive"
        >
          <Ban data-icon="inline-start" aria-hidden="true" />
          Закрыть как неактуальный
        </Button>
      ) : null}
    </div>
  );
}

function handleDragStart(
  event: DragEvent<HTMLElement>,
  order: AdminOrder,
  onDragStart: (orderId: string | null) => void,
) {
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", order.id);
  onDragStart(order.id);
}

function getColumnCount(
  orders: readonly AdminOrder[],
  status: OrderStatus,
) {
  return getOrdersByStatus(orders, status).length;
}

function getCompletedOrdersCount(orders: readonly AdminOrder[]) {
  return orders.filter((order) => order.status === "completed").length;
}

function getHistoryEventText(event: AdminOrder["history"][number]) {
  if (event.eventType === "status_changed") {
    const fromStatus = getStatusLabel(event.payload.fromStatus);
    const toStatus = getStatusLabel(event.payload.toStatus);

    if (!toStatus) {
      return "Статус изменен";
    }

    return fromStatus ? `${fromStatus} -> ${toStatus}` : `Статус: ${toStatus}`;
  }

  if (event.eventType === "comment_created") {
    return "Комментарий добавлен";
  }

  return event.eventType;
}

function getHistoryAuthorLabel(eventType: string) {
  return eventType === "status_changed" ? "Система" : "Администратор";
}

function getStatusLabel(value: unknown) {
  if (typeof value !== "string" || !(value in orderCrmStatusLabels)) {
    return undefined;
  }

  return orderCrmStatusLabels[value as AdminOrder["status"]];
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
  }).format(new Date(value));
}
