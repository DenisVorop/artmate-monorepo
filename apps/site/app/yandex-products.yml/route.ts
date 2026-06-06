import { getProductsData } from "@/shared/actions/products";
import { createYandexProductsFeed } from "@/shared/lib/yandex-products-feed";

export const revalidate = 300;

export async function GET() {
  const productsResult = await getProductsData();

  if (!productsResult.data) {
    return new Response("Failed to build Yandex products feed", {
      headers: {
        "content-type": "text/plain; charset=utf-8",
      },
      status: 502,
    });
  }

  return new Response(createYandexProductsFeed(productsResult.data), {
    headers: {
      "cache-control": "public, s-maxage=300, stale-while-revalidate=86400",
      "content-type": "application/xml; charset=utf-8",
    },
  });
}
