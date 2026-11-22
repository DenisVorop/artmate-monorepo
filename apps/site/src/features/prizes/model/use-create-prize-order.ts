"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { prizesQuery, type ProductPrize } from "@/entities/prize";
import { ordersQuery } from "@/entities/orders";
import { createPrizeOrder, type CreatePrizeOrderInput } from "@/shared/actions/prizes";
import { ApiResult } from "@/shared/lib/api-result";
import { routes } from "@/shared/constants";
export function useCreatePrizeOrder(
  owner: string,
  prize: ProductPrize,
  onError: (_message: string) => void,
) {
  const client = useQueryClient();
  const router = useRouter();
  const { mutate, isPending } = useMutation({
    mutationFn: async (input: CreatePrizeOrderInput) => {
      return ApiResult.fromDTO(await createPrizeOrder(prize.id, input)).unwrap()!;
    },
    onSuccess: (order) => {
      client.setQueryData(ordersQuery.getOrder(order.id).queryKey, order);
      client.setQueryData<ProductPrize | null>(
        prizesQuery.detail(owner, prize.id).queryKey,
        () => ({
          ...prize,
          orderId: order.id,
        }),
      );
      void client.invalidateQueries({ queryKey: prizesQuery.list(owner).queryKey });
      void client.invalidateQueries({ queryKey: ordersQuery.baseKey });
      router.replace(routes.accountOrders);
    },
    onError: (error) => {
      onError(error instanceof Error ? error.message : "Не удалось оформить приз");
      void client.invalidateQueries({ queryKey: prizesQuery.detail(owner, prize.id).queryKey });
    },
  });
  return { mutate, isPending };
}
