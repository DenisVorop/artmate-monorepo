import * as React from "react";
import { Separator as SeparatorPrimitive } from "radix-ui";

import { cn } from "@/shared/lib/utils";

function Separator({
  className,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      decorative
      className={cn("h-px w-full shrink-0 bg-border", className)}
      {...props}
    />
  );
}

export { Separator };
