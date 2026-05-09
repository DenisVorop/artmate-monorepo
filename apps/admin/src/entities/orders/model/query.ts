import { queryOptions } from "@tanstack/react-query";

import { getAdminOrders } from "@/shared/actions/orders";

const adminOrdersStaleTimeMs = 1000 * 60;

export const ordersQueryKeys = {
  all: ["admin-orders"] as const,
  board: () => [...ordersQueryKeys.all, "board"] as const,
};

export const ordersQuery = {
  board: () =>
    queryOptions({
      queryKey: ordersQueryKeys.board(),
      queryFn: getAdminOrders,
      staleTime: adminOrdersStaleTimeMs,
      retryOnMount: false,
    }),
};
