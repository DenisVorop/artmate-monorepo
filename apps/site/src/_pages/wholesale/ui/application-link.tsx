import { ArrowDownRight } from "lucide-react";

import { cn } from "@/shared/lib";
import { Button, CtaGradientLink } from "@/shared/ui";

export function ApplicationLink({ className }: { readonly className?: string }) {
  return (
    <Button
      asChild
      className={cn(
        "h-12 max-w-full gap-2 border-0 bg-linear-to-r from-rose-500 via-rose-400 to-orange-400 px-5 text-sm font-bold text-white shadow-lg shadow-rose-300/25 hover:from-rose-500 hover:via-rose-400 hover:to-orange-400 focus-visible:ring-rose-400/40",
        className,
      )}
    >
      <CtaGradientLink href="#wholesale-application">
        Получить оптовые условия
        <ArrowDownRight aria-hidden className="size-4" />
      </CtaGradientLink>
    </Button>
  );
}
