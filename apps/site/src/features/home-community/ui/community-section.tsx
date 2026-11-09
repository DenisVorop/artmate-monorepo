import type { ReactNode } from "react";

import { routes } from "@/shared/constants";
import { cn } from "@/shared/lib";
import { Button } from "@/shared/ui";
import { Link } from "@/shared/ui/link";
import { SectionTitle } from "@/shared/ui/typography";

export function HomeCommunitySection({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("container", className)} aria-labelledby="home-community-title">
      <div className="mb-5 flex items-center justify-between gap-4 md:mb-6">
        <SectionTitle
          id="home-community-title"
          style={{ fontSize: "clamp(1.25rem, 3vw, 1.75rem)" }}
        >
          Работы участников
        </SectionTitle>
        <Button asChild variant="link" className="min-h-11 shrink-0 text-rose-600">
          <Link href={routes.gallery}>Все работы</Link>
        </Button>
      </div>
      {children}
    </section>
  );
}
