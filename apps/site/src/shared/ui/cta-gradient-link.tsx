"use client";

import NextLink from "next/link";
import {
  forwardRef,
  useEffect,
  useRef,
  type ComponentPropsWithoutRef,
  type PointerEvent,
} from "react";
import { cn } from "@/shared/lib/utils";

type CtaGradientLinkProps = ComponentPropsWithoutRef<typeof NextLink>;

type PointerSnapshot = {
  x: number;
  y: number;
};

const CtaGradientLink = forwardRef<HTMLAnchorElement, CtaGradientLinkProps>(
  ({ children, className, onPointerEnter, onPointerMove, onPointerLeave, ...props }, ref) => {
    const boundsRef = useRef<DOMRect | null>(null);
    const frameRef = useRef<number | null>(null);
    const orbRef = useRef<HTMLSpanElement | null>(null);
    const pointerRef = useRef<PointerSnapshot | null>(null);

    useEffect(() => {
      return () => {
        if (frameRef.current !== null) {
          window.cancelAnimationFrame(frameRef.current);
        }
      };
    }, []);

    const schedulePointerPosition = (event: PointerEvent<HTMLAnchorElement>) => {
      pointerRef.current = {
        x: event.clientX,
        y: event.clientY,
      };

      if (frameRef.current !== null) {
        return;
      }

      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;

        const pointer = pointerRef.current;
        const bounds = boundsRef.current;
        const orb = orbRef.current;

        if (!pointer || !bounds || !orb) {
          return;
        }

        orb.style.transform = `translate(${pointer.x - bounds.left}px, ${pointer.y - bounds.top}px) translate(-50%, -50%)`;
      });
    };

    return (
      <NextLink
        ref={ref}
        className={cn("cta-gradient-hover focus-visible:ring-rose-400/30", className)}
        onPointerEnter={(event) => {
          boundsRef.current = event.currentTarget.getBoundingClientRect();
          schedulePointerPosition(event);
          onPointerEnter?.(event);
        }}
        onPointerMove={(event) => {
          schedulePointerPosition(event);
          onPointerMove?.(event);
        }}
        onPointerLeave={(event) => {
          boundsRef.current = null;
          pointerRef.current = null;
          onPointerLeave?.(event);
        }}
        {...props}
      >
        <span ref={orbRef} data-slot="cta-gradient-orb" aria-hidden />
        <span data-slot="cta-gradient-content">{children}</span>
      </NextLink>
    );
  },
);

CtaGradientLink.displayName = "CtaGradientLink";

export { CtaGradientLink };
