"use client";

import {
  forwardRef,
  useEffect,
  useRef,
  type ComponentPropsWithoutRef,
  type PointerEvent,
} from "react";
import type { VariantProps } from "class-variance-authority";

import { cn } from "@/shared/lib/utils";

import { buttonVariants } from "./button";

type CtaGradientButtonProps = ComponentPropsWithoutRef<"button"> &
  VariantProps<typeof buttonVariants>;

type PointerSnapshot = {
  x: number;
  y: number;
};

const CtaGradientButton = forwardRef<HTMLButtonElement, CtaGradientButtonProps>(
  (
    {
      children,
      className,
      onPointerEnter,
      onPointerMove,
      onPointerLeave,
      size = "lg",
      variant = "default",
      ...props
    },
    ref,
  ) => {
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

    const schedulePointerPosition = (event: PointerEvent<HTMLButtonElement>) => {
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
      <button
        ref={ref}
        data-slot="button"
        data-variant={variant}
        data-size={size}
        className={cn(
          buttonVariants({
            variant,
            size,
            className: cn(
              "cta-gradient-hover border-0 bg-gradient-to-r from-rose-500 via-rose-400 to-orange-400 font-semibold text-white shadow-sm shadow-rose-500/20 hover:from-rose-500/95 hover:via-rose-400/95 hover:to-orange-400/95 focus-visible:ring-rose-400/30",
              className,
            ),
          }),
        )}
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
      </button>
    );
  },
);

CtaGradientButton.displayName = "CtaGradientButton";

export { CtaGradientButton };
