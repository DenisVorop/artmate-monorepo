export const productsQueryKeys = {
  all: ["admin-products"] as const,
  categories: () => [...productsQueryKeys.all, "categories"] as const,
  list: () => [...productsQueryKeys.all, "list"] as const,
};
