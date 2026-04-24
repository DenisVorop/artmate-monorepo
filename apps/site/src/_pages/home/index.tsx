"use client";

import { useHomeData } from "@/entities/home";
import { useProductsData } from "@/entities/products";
import { useReviewsData } from "@/entities/reviews";
import { HeroSection } from "./ui/hero-section";
import { AdvantagesCarousel } from "./ui/advantages-carousel";
import { HowItWorks } from "./ui/how-it-works";
import { Bestsellers } from "@/features/best-sellers";
import { Reviews } from "./ui/reviews";

export function HomePage() {
  const { homeData } = useHomeData();
  const { products } = useProductsData();
  const { reviews, stats: reviewStats } = useReviewsData();

  return (
    <main>
      <HeroSection
        metrics={homeData.heroMetrics}
        reviewStats={reviewStats}
        className="my-4 md:my-8"
      />

      <AdvantagesCarousel advantages={homeData.advantages} />

      <HowItWorks steps={homeData.howItWorksSteps} className="py-4 md:py-8" />

      <Bestsellers products={products} className="py-4 md:py-8" />

      <Reviews reviews={reviews} stats={reviewStats} className="py-4 md:py-8" />
    </main>
  );
}
