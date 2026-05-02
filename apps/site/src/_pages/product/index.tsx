import { ProductDetails } from "@/features/product-details";

type ProductPageProps = {
  productId: string;
};

export function ProductPage({ productId }: ProductPageProps) {
  return <ProductDetails productId={productId} />;
}
