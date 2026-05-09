import type { OrderStatus } from "@/entities/orders";

export type OrderCrmColumn = {
  readonly status: OrderStatus;
  readonly title: string;
  readonly description: string;
  readonly markerClassName: string;
};

export const orderCrmColumns: readonly OrderCrmColumn[] = [
  {
    status: "new",
    title: "Новые",
    description: "В обработке в ЛК",
    markerClassName: "bg-sky-500",
  },
  {
    status: "in_progress",
    title: "В работе",
    description: "Менеджер ведет заказ",
    markerClassName: "bg-amber-500",
  },
  {
    status: "waiting_payment",
    title: "Ожидают оплаты",
    description: "Согласованы с клиентом",
    markerClassName: "bg-violet-500",
  },
  {
    status: "paid",
    title: "Оплачено",
    description: "Оплата получена",
    markerClassName: "bg-teal-500",
  },
  {
    status: "delivering",
    title: "Доставляются",
    description: "Заказы в доставке",
    markerClassName: "bg-cyan-500",
  },
  {
    status: "completed",
    title: "Завершены",
    description: "Заказы закрыты",
    markerClassName: "bg-emerald-500",
  },
  {
    status: "cancelled",
    title: "Отменены",
    description: "Неактуальные заявки",
    markerClassName: "bg-rose-500",
  },
] as const;

export const orderCrmStatusLabels = Object.fromEntries(
  orderCrmColumns.map((column) => [column.status, column.title]),
) as Record<OrderStatus, string>;
