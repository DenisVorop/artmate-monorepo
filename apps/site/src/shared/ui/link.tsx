import NextLink from "next/link";
import { isSensitivePath } from "../lib/is-sensitive-path";
import { cn } from "../lib";

export function Link({ className, children, ...props }: React.ComponentProps<typeof NextLink>) {
  if (typeof props.href === "string" && isSensitivePath(props.href.split(/[?#]/u)[0] ?? "")) {
    const {
      href,
      prefetch: _prefetch,
      replace: _replace,
      scroll: _scroll,
      shallow: _shallow,
      locale: _locale,
      as: _as,
      onNavigate: _onNavigate,
      legacyBehavior: _legacyBehavior,
      passHref: _passHref,
      ...anchorProps
    } = props;
    return (
      <a
        {...anchorProps}
        href={href}
        className={cn(
          "transition-colors hover:text-stone-900 focus-visible:text-stone-900 focus-visible:outline-none",
          className,
        )}
      >
        {children}
      </a>
    );
  }
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
