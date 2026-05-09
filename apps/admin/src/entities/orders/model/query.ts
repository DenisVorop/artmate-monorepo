import { queryOptions } from "@tanstack/react-query";

import { getAdminOrder, getAdminOrders } from "@/shared/actions/orders";

const adminOrdersStaleTimeMs = 1000 * 60;

export const ordersQueryKeys = {
  all: ["admin-orders"] as const,
  board: () => [...ordersQueryKeys.all, "board"] as const,
  detail: (orderId: string) =>
    [...ordersQueryKeys.all, "detail", orderId] as const,
};

export const ordersQuery = {
  board: () =>
    queryOptions({
      queryKey: ordersQueryKeys.board(),
      queryFn: getAdminOrders,
      staleTime: adminOrdersStaleTimeMs,
      retryOnMount: false,
    }),
  detail: (orderId: string) =>
    queryOptions({
      queryKey: ordersQueryKeys.detail(orderId),
      queryFn: () => getAdminOrder(orderId),
      staleTime: adminOrdersStaleTimeMs,
      retryOnMount: false,
    }),
};
