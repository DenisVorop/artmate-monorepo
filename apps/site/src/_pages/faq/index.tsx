import { Faq } from "@/features/faq";
import { Separator } from "@/shared";
import { Hero } from "./ui/hero";

export function FaqPage() {
  return (
    <main className="bg-background">
      <Hero />

      <div className="container">
        <Separator />
      </div>

      <Faq />
    </main>
  );
}

export { metadata } from "./metadata";
