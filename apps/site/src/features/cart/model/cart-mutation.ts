import type { QueryClient } from "@tanstack/react-query";

import { cartQuery, type CartResult } from "@/entities/cart";

export const cartMutationScope = { id: "cart" } as const;

export async function executeCartMutation(
  queryClient: QueryClient,
  mutation: () => Promise<CartResult | undefined>,
) {
  const previousCart = await getCartSnapshot(queryClient);
  const cart = await mutation();

  return { cart, previousCart };
}

async function getCartSnapshot(queryClient: QueryClient) {
  const cachedCart = queryClient.getQueryData<CartResult>(cartQuery.getCart().queryKey);

  if (cachedCart !== undefined) {
    return cachedCart;
  }

  try {
    return await queryClient.ensureQueryData(cartQuery.getCart());
  } catch {
    return undefined;
  }
}
