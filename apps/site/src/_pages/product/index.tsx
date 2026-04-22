import { ProductPurchase } from "@/features/product-purchase";
import {
  DetailsTabs,
  Gallery,
  Highlights,
  Related,
  Summary,
  type Product,
} from "@/entities/products";
import { REVIEWS, ReviewList, ReviewRatingSummary } from "@/entities/reviews";
import { Separator } from "@/shared";
import { Breadcrumbs } from "./ui/breadcrumbs";

export { metadata } from "./metadata";

type ProductPageProps = {
  product: Product;
  relatedProducts: Product[];
};

export function ProductPage({ product, relatedProducts }: ProductPageProps) {
  return (
    <main className="bg-background">
      <div className="container space-y-3 py-4 md:space-y-5 md:py-8">
        <Breadcrumbs product={product} />

        <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.86fr)] lg:gap-12">
          <Gallery images={product.images} title={product.title} />

          <div className="space-y-6">
            <ReviewRatingSummary className="justify-start" />
            <Summary product={product} />
            <ProductPurchase product={product} />
            <Highlights />
            <DetailsTabs reviews={<ReviewList reviews={REVIEWS} />} />
          </div>
        </section>

        <Separator />

        <Related products={relatedProducts} />
      </div>
    </main>
  );
}
