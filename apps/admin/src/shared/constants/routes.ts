export const routes = {
  blog: "/blog",
  blogAuthors: "/blog/authors",
  blogCategories: "/blog/categories",
  blogPost: (postId: string) => `/blog/${postId}`,
  blogPosts: "/blog/posts",
  blogTags: "/blog/tags",
  home: "/",
  login: "/login",
  product: (productId: string) => `/products/${productId}`,
  productCategories: "/products/categories",
  products: "/products",
  users: "/users",
} as const;
