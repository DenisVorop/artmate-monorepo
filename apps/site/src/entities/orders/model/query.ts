import { queryOptions } from "@tanstack/react-query";

import { getMyOrders, getOrder, getOrderStatus } from "@/shared/actions/orders";
import { ApiResult } from "@/shared/lib/api-result";

import type { Order, OrderState } from "./types";

export type OrdersResult = Order[];

const baseKey = "orders";

export const ordersQuery = {
  baseKey: [baseKey],
  getMyOrders: (userId: string, limit = 20, offset = 0) =>
    queryOptions({
      queryKey: [baseKey, "my", userId, limit, offset] as const,
      queryFn: async ({ signal }) => {
        const result = await getMyOrders(limit, offset);
        signal.throwIfAborted();
        return ApiResult.fromDTO(result).unwrap() ?? [];
      },
      staleTime: 1000 * 30,
      retryOnMount: false,
    }),
  getOrder: (orderId: string) =>
    queryOptions({
      queryKey: [baseKey, "detail", orderId] as const,
      queryFn: async () => ApiResult.fromDTO(await getOrder(orderId)).unwrap(),
      staleTime: 1000 * 30,
      retryOnMount: false,
    }),
  getOrderStatus: (orderId: string) =>
    queryOptions({
      queryKey: [baseKey, "status", orderId] as const,
      queryFn: async () => ApiResult.fromDTO(await getOrderStatus(orderId)).unwrap() as OrderState,
      staleTime: 0,
      retryOnMount: true,
    }),
};
