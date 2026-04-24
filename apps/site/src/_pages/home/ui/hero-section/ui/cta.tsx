import { Button, CtaGradientLink } from "@/shared/ui";
import { routes } from "@/shared/constants";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

export function CTA() {
  return (
    <div className="mb-6 flex flex-wrap gap-3">
      <Button
        asChild
        size="lg"
        className="border-0 bg-gradient-to-r from-rose-500 via-rose-400 to-orange-400 font-semibold text-white shadow-sm shadow-rose-500/20 hover:from-rose-500/95 hover:via-rose-400/95 hover:to-orange-400/95"
      >
        <CtaGradientLink href={routes.catalog}>
          В каталог
          <ArrowRight
            data-icon="inline-end"
            className="transition-transform group-hover/button:translate-x-0.5"
          />
        </CtaGradientLink>
      </Button>

      <Button asChild size="lg" variant="outline">
        <Link href={routes.gallery}>Галерея работ</Link>
      </Button>
    </div>
  );
}
