import { Blog } from "@/features/blog";
import { Separator } from "@/shared";
import { Hero } from "./ui/hero";

export function BlogPage() {
  return (
    <main className="bg-background">
      <Hero />

      <div className="container">
        <div className="mx-auto max-w-4xl">
          <Separator />
        </div>
      </div>

      <Blog />
    </main>
  );
}

export { metadata } from "./metadata";
