import { Application } from "./ui/application";
import { Formats } from "./ui/formats";
import { Hero } from "./ui/hero";
import { Terms } from "./ui/terms";

export function WholesalePage() {
  return (
    <main className="overflow-hidden bg-[#fbfaf8] text-stone-950">
      <Hero />
      <Formats />
      <Terms />
      <Application />
    </main>
  );
}
