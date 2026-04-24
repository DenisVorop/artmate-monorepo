import { Faq } from "@/features/faq";
import { Separator } from "@/shared/ui";
import { Hero } from "./ui/hero";

export function FaqPage() {
  return (
    <main className="bg-background">
      <Hero />

      <div className="container">
        <div className="mx-auto max-w-4xl">
          <Separator />
        </div>
      </div>

      <Faq />
    </main>
  );
}

export { metadata } from "./metadata";
