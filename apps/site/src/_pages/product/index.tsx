"use client";

import { ProductPurchase } from "@/features/product-purchase";
import {
  DetailsTabs,
  Gallery,
  Highlights,
  Related,
  Summary,
  getProductById,
  getRelatedProducts,
} from "@/entities/products";
import { ReviewList, ReviewRatingSummary } from "@/entities/reviews";
import { useProductsData } from "@/entities/products";
import { useReviewsData } from "@/entities/reviews";
import { Separator } from "@/shared";
import { Breadcrumbs } from "./ui/breadcrumbs";

type ProductPageProps = {
  productId: string;
};

export function ProductPage({ productId }: ProductPageProps) {
  const { products, productSpecs, productHowItWorks, productHighlights } = useProductsData();
  const { reviews, stats: reviewStats } = useReviewsData();
  const product = getProductById(products, productId);

  if (!product) {
    return null;
  }

  const relatedProducts = getRelatedProducts(products, product);

  return (
    <main className="bg-background">
      <div className="container space-y-3 py-4 md:space-y-5 md:py-8">
        <Breadcrumbs product={product} />

        <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.86fr)] lg:gap-12">
          <Gallery images={product.images} title={product.title} />

          <div className="space-y-6">
            <ReviewRatingSummary stats={reviewStats} className="justify-start" />
            <Summary product={product} />
            <ProductPurchase product={product} />
            <Highlights items={productHighlights} />
            <DetailsTabs
              specs={productSpecs}
              howItWorks={productHowItWorks}
              reviews={<ReviewList reviews={reviews} />}
            />
          </div>
        </section>

        <Separator />

        <Related products={relatedProducts} />
      </div>
    </main>
  );
}
