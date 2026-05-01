export const productsQueryKeys = {
  all: ["admin-products"] as const,
  categories: () => [...productsQueryKeys.all, "categories"] as const,
  detail: (productId: string) =>
    [...productsQueryKeys.all, "detail", productId] as const,
  list: () => [...productsQueryKeys.all, "list"] as const,
};
