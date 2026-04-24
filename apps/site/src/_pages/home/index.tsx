"use client";

import { useHomeData } from "@/entities/home";
import { useProductsData } from "@/entities/products";
import { useReviewsData } from "@/entities/reviews";
import { DataState } from "@/shared/ui";
import { HeroSection } from "./ui/hero-section";
import { AdvantagesCarousel } from "./ui/advantages-carousel";
import { HowItWorks } from "./ui/how-it-works";
import { Bestsellers } from "@/features/best-sellers";
import { Reviews } from "./ui/reviews";

export function HomePage() {
  const home = useHomeData();
  const products = useProductsData();
  const reviews = useReviewsData();

  if (home.isError) {
    return (
      <main className="container py-10">
        <DataState
          variant="error"
          title="Не удалось загрузить главную страницу"
          description="Обновите страницу или попробуйте вернуться позже."
        />
      </main>
    );
  }

  if (!home.data) {
    return null;
  }

  if (home.data.isEmpty) {
    return (
      <main className="container py-10">
        <DataState
          title="Данные главной страницы пока не добавлены"
          description="Когда появятся блоки страницы, они отобразятся здесь."
        />
      </main>
    );
  }

  const homeData = home.data.data!;
  const visibleProductsData =
    !products.isError && products.data && !products.data.isEmpty ? products.data.data! : undefined;
  const visibleReviewsData =
    !reviews.isError && reviews.data && !reviews.data.isEmpty ? reviews.data.data! : undefined;

  return (
    <main>
      <HeroSection
        metrics={homeData.heroMetrics}
        reviewStats={visibleReviewsData?.stats}
        className="my-4 md:my-8"
      />

      <AdvantagesCarousel advantages={homeData.advantages} />

      <HowItWorks steps={homeData.howItWorksSteps} className="py-4 md:py-8" />

      {visibleProductsData ? (
        <Bestsellers products={visibleProductsData.products} className="py-4 md:py-8" />
      ) : (
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
      )}

      {visibleReviewsData ? (
        <Reviews
          reviews={visibleReviewsData.reviews}
          stats={visibleReviewsData.stats}
          className="py-4 md:py-8"
        />
      ) : (
        <section className="container py-4 md:py-8">
          <DataState
            variant={reviews.isError ? "error" : "empty"}
            title={reviews.isError ? "Не удалось загрузить отзывы" : "Отзывы пока не добавлены"}
            description={
              reviews.isError
                ? "Обновите страницу или попробуйте вернуться позже."
                : "Когда появятся первые отзывы, они отобразятся здесь."
            }
          />
        </section>
      )}
    </main>
  );
}
