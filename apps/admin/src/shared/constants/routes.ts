export const routes = {
  home: "/",
  login: "/login",
  product: (productId: string) => `/products/${productId}`,
  products: "/products",
  users: "/users",
} as const;
