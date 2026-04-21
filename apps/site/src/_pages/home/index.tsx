import { HeroSection } from "./ui/hero-section";
import { AdvantagesCarousel } from "./ui/advantages-carousel";
import { HowItWorks } from "./ui/how-it-works";
import { Bestsellers } from "@/features/best-sellers";
import { Reviews } from "./ui/reviews";

export { metadata } from "./metadata";

export function HomePage() {
  return (
    <main>
      <HeroSection className="my-4 md:my-8" />

      <AdvantagesCarousel />

      <HowItWorks className="py-4 md:py-8" />

      <Bestsellers className="py-4 md:py-8" />

      <Reviews className="py-4 md:py-8" />
    </main>
  );
}
