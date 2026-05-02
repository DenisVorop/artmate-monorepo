"use client";

import { useProductsData } from "@/entities/products";
import { CartProductCard, useAddProductToCart } from "@/features/cart";
import { DataState } from "@/shared/ui";

import { BaseBestsellers } from "./base-bestsellers";

type BestsellersProps = {
  className?: string;
};

export function Bestsellers({ className }: BestsellersProps) {
  const products = useProductsData();
  const addProductToCart = useAddProductToCart();

  if (products.isError || !products.data || products.data.products.length === 0) {
    return (
      <section className="container py-4 md:py-8">
        <DataState
          variant={products.isError ? "error" : "empty"}
          title={
            products.isError ? "Не удалось загрузить хиты продаж" : "Хиты продаж пока не добавлены"
          }
          description={
            products.isError
              ? "Обновите страницу или попробуйте вернуться позже."
              : "Когда в каталоге появятся товары, они отобразятся здесь."
          }
        />
      </section>
    );
  }

  return (
    <BaseBestsellers
      products={products.data.products}
      className={className}
      renderProductCard={(product) => (
        <CartProductCard product={product} onAddToCart={addProductToCart} />
      )}
    />
  );
}
