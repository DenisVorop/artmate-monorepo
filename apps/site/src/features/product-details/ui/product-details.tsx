"use client";

import { CartProductCard, useAddProductToCart } from "@/features/cart";
import { ProductPurchase } from "@/features/product-purchase";
import {
  Description,
  DetailsTabs,
  Gallery,
  Highlights,
  Related,
  Summary,
  getProductById,
  getRelatedProducts,
  useProductsData,
} from "@/entities/products";
import {
  ReviewList,
  ReviewRatingSummary,
  useReviewsData,
} from "@/entities/reviews";
import { DataState, Separator } from "@/shared/ui";

import { Breadcrumbs } from "./breadcrumbs";

type ProductDetailsProps = {
  productId: string;
};

export function ProductDetails({ productId }: ProductDetailsProps) {
  const products = useProductsData();
  const reviews = useReviewsData();
  const addProductToCart = useAddProductToCart();

  if (products.isError) {
    return (
      <main className="container py-10">
        <DataState
          variant="error"
          title="Не удалось загрузить товар"
          description="Обновите страницу или попробуйте вернуться позже."
        />
      </main>
    );
  }

  if (!products.data) {
    return null;
  }

  if (products.data.products.length === 0) {
    return (
      <main className="container py-10">
        <DataState
          title="Каталог пока пуст"
          description="Когда появятся товары, карточка станет доступна."
        />
      </main>
    );
  }

  const productsData = products.data;
  const product = getProductById(productsData.products, productId);

  if (!product) {
    return (
      <main className="container py-10">
        <DataState
          title="Товар не найден"
          description="Возможно, он был снят с публикации или адрес страницы изменился."
        />
      </main>
    );
  }

  const relatedProducts = getRelatedProducts(productsData.products, product);
  const visibleReviewsData =
    !reviews.isError && reviews.data && reviews.data.reviews.length > 0
      ? reviews.data
      : undefined;

  return (
    <main className="bg-background">
      <div className="container space-y-3 py-4 md:space-y-5 md:py-8">
        <Breadcrumbs product={product} />

        <section className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.86fr)] lg:gap-12">
          <Gallery images={product.images} title={product.title} />

          <div className="min-w-0 space-y-6">
            {visibleReviewsData && (
              <ReviewRatingSummary stats={visibleReviewsData.stats} className="justify-start" />
            )}
            <Summary product={product} />
            <ProductPurchase product={product} onAddToCart={addProductToCart} />
            <Highlights items={productsData.productHighlights} />
            <DetailsTabs
              specs={productsData.productSpecs}
              howItWorks={productsData.productHowItWorks}
              reviews={
                visibleReviewsData ? (
                  <ReviewList reviews={visibleReviewsData.reviews} />
                ) : (
                  <DataState
                    variant={reviews.isError ? "error" : "empty"}
                    title={
                      reviews.isError
                        ? "Не удалось загрузить отзывы"
                        : "Отзывы пока не добавлены"
                    }
                    description={
                      reviews.isError
                        ? "Обновите страницу или попробуйте вернуться позже."
                        : "Когда появятся первые отзывы, они отобразятся здесь."
                    }
                  />
                )
              }
            />
          </div>
        </section>

        <Separator />

        <Description product={product} />

        <Separator />

        <Related
          products={relatedProducts}
          renderProductCard={(relatedProduct) => <CartProductCard product={relatedProduct} />}
        />
      </div>
    </main>
  );
}
