export const routes = {
  blog: "/blog",
  blogPost: (postId: string) => `/blog/${postId}`,
  home: "/",
  login: "/login",
  product: (productId: string) => `/products/${productId}`,
  products: "/products",
  users: "/users",
} as const;
