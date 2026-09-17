import { queryOptions } from "@tanstack/react-query";

import { getAdminOrderRefunds } from "@/shared/actions/orders";

export const orderRefundsQueryKeys = {
  all: ["admin-order-refunds"] as const,
  detail: (orderId: string) =>
    [...orderRefundsQueryKeys.all, orderId] as const,
};

export const orderRefundsQuery = (orderId: string) =>
  queryOptions({
    queryKey: orderRefundsQueryKeys.detail(orderId),
    queryFn: () => getAdminOrderRefunds(orderId),
    staleTime: Infinity,
    retryOnMount: false,
  });
