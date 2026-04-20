import { Button, CtaGradientLink, routes } from "@/shared";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

export function CTA() {
  return (
    <div className="mb-6 flex flex-wrap gap-3">
      <Button asChild size="lg">
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
