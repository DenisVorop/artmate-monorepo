"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { cartQuery } from "@/entities/cart";
import { addCartItem, type AddCartItemInputDTO } from "@/shared/actions/cart";
import { ApiResult } from "@/shared/lib/api-result";
import { cartPricingQueryKey } from "@/shared/lib/query-keys";
import { routes } from "@/shared/constants";

import { useAnalytics } from "../lib/analytics";
import { cartMutationScope, executeCartMutation } from "./cart-mutation";

export function useAddCartItemMutation() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const analytics = useAnalytics();

  const { mutateAsync, isPending } = useMutation({
    scope: cartMutationScope,
    mutationFn: (input: AddCartItemInputDTO) =>
      executeCartMutation(queryClient, async () =>
        ApiResult.fromDTO(await addCartItem(input)).unwrap(),
      ),
    onSuccess: ({ cart, previousCart }, input) => {
      analytics.cartItemAdded(cart, input, previousCart);
      queryClient.setQueryData(cartQuery.getCart().queryKey, cart ?? null);
      void queryClient.invalidateQueries({ queryKey: cartPricingQueryKey });
      const addedItem = cart?.items.find((item) => item.id === input.productId);
      const previousQuantity =
        previousCart?.items.find((item) => item.id === input.productId)?.quantity ?? 0;
      if (
        addedItem &&
        addedItem.quantity > 0 &&
        (previousCart === undefined || addedItem.quantity > previousQuantity)
      ) {
        toast.success("Добавлено в корзину", {
          id: `cart-add-${input.productId}`,
          description: addedItem.title,
          action: {
            label: "Открыть корзину",
            onClick: () => {
              analytics.toastCartOpened();
              router.push(routes.cart);
            },
          },
        });
      }
    },
    onError: (_error, input) => {
      analytics.addFailed();
      toast.error("Не удалось добавить товар", {
        id: `cart-add-${input.productId}`,
        description: "Попробуйте ещё раз.",
      });
    },
  });
  const mutate = useCallback(
    async (input: AddCartItemInputDTO) => (await mutateAsync(input)).cart,
    [mutateAsync],
  );

  return {
    mutate,
    isPending,
  };
}
