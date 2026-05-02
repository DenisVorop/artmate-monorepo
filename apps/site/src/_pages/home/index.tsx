import { Bestsellers } from "@/features/best-sellers";
import { AdvantagesCarousel } from "./ui/advantages-carousel";
import { HeroSection } from "./ui/hero-section";
import { HowItWorks } from "./ui/how-it-works";
import { Reviews } from "./ui/reviews";

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
