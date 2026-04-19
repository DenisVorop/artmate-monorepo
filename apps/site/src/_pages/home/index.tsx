import { HeroSection } from "./ui/hero-section";
import { AdvantagesCarousel } from "./ui/advantages-carousel";

export { metadata } from "./metadata";

export function HomePage() {
  return (
    <main>
      <HeroSection className="my-4 md:my-8" />

      <AdvantagesCarousel />
    </main>
  );
}
