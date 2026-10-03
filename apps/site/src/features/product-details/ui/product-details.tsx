"use client";

import { CartProductCard, useAddProductToCart } from "@/features/cart";
import { ProductPurchase } from "@/features/product-purchase";
import {
  Characteristics,
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
import { ReviewRatingSummary, useReviewsData } from "@/entities/reviews";
import { Button, DataState, Separator } from "@/shared/ui";

import { useTrackProductView } from "../lib/use-track-product-view";
import { Breadcrumbs } from "./breadcrumbs";
import { MarketplaceLinks } from "./marketplace-links";

type ProductDetailsProps = {
  productId: string;
};

export function ProductDetails({ productId }: ProductDetailsProps) {
  const products = useProductsData();
  const reviews = useReviewsData();
  const addProductToCart = useAddProductToCart();
  const product =
    !products.isError && products.data
      ? getProductById(products.data.products, productId)
      : undefined;
  useTrackProductView(product);

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

  const productsData = products.data;
  const relatedProducts = getRelatedProducts(productsData.products, product);
  const reviewsStats = !reviews.isError && reviews.data ? reviews.data.stats : undefined;

  return (
    <main className="bg-background">
      <div className="container space-y-3 py-4 md:space-y-5 md:py-8">
        <Breadcrumbs product={product} />

        <section className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.86fr)] lg:gap-12">
          <Gallery images={product.images} title={product.title} />

          <div className="min-w-0 space-y-6">
            {reviewsStats && <ReviewRatingSummary stats={reviewsStats} className="justify-start" />}
            <Summary product={product} />
            <ProductPurchase product={product} onAddToCart={addProductToCart} />
            <Highlights characteristics={product.characteristics} />
            {product.characteristics.length > 0 && (
              <Button asChild variant="link" className="min-h-11 px-0 text-foreground">
                <a href="#product-characteristics">Все характеристики</a>
              </Button>
            )}
            <DetailsTabs
              key={product.id}
              usageInstructions={product.usageInstructions}
              reviews={<MarketplaceLinks />}
            />
          </div>
        </section>

        <Separator />

        <Description product={product} />

        <Characteristics
          key={product.id}
          id="product-characteristics"
          characteristics={product.characteristics}
          productTitle={product.title}
        />

        <Separator />

        <Related
          products={relatedProducts}
          renderProductCard={(relatedProduct, index) => (
            <CartProductCard
              product={relatedProduct}
              list="related_products"
              position={index + 1}
            />
          )}
        />
      </div>
    </main>
  );
}
