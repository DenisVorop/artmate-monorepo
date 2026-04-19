import { HeroSection } from "./ui/hero-section";

export { metadata } from "./metadata";

export function HomePage() {
  return (
    <main>
      <HeroSection className="my-4 md:my-8" />
    </main>
  );
}
