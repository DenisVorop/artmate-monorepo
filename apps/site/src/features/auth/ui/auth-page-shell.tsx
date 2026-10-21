import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";

import { routes } from "@/shared/constants";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";

export function AuthPageShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-stone-100 px-4 py-6 sm:px-8">
      <div className={cn("flex w-full max-w-177 flex-col gap-3", className)}>
        <Button
          asChild
          variant="link"
          className="min-h-11 justify-start gap-2 self-start px-0 text-sm text-stone-500 no-underline hover:no-underline sm:text-base"
        >
          <a href={routes.home}>
            <ChevronLeft aria-hidden="true" className="size-5 -translate-y-px" />
            Вернуться на сайт
          </a>
        </Button>
        {children}
      </div>
    </div>
  );
}
