import NextLink from "next/link";
import { cn } from "../lib";

export function Link({ className, children, ...props }: React.ComponentProps<typeof NextLink>) {
  return (
    <NextLink
      className={cn(
        "transition-colors hover:text-stone-900 focus-visible:text-stone-900 focus-visible:outline-none",
        className,
      )}
      {...props}
    >
      {children}
    </NextLink>
  );
}
