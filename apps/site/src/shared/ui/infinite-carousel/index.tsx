"use client";

import * as React from "react";

import { cn } from "@/shared/lib/utils";

type InfiniteCarouselProps = Omit<React.ComponentPropsWithoutRef<"div">, "children"> & {
  children: React.ReactNode;
  /** Animation speed in pixels per second. */
  speed?: number;
  trackClassName?: string;
};

/**
 * Repeats children enough times to fill the viewport and animates them as a seamless track.
 */
function InfiniteCarousel({
  children,
  speed = 50,
  className,
  trackClassName,
  ...props
}: InfiniteCarouselProps) {
  const [clonedChildren, setClonedChildren] = React.useState<React.ReactNode>(children);
  const carouselRef = React.useRef<HTMLDivElement>(null);
  const trackRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const carousel = carouselRef.current;
    const track = trackRef.current;

    if (!carousel || !track) return;

    const sourceChildren = React.Children.toArray(children);

    const syncChildren = () => {
      const carouselWidth = carousel.offsetWidth;
      const sourceElements = Array.from(track.children).slice(0, sourceChildren.length);
      const childrenWidth = sourceElements.reduce((acc, child) => {
        const styles = getComputedStyle(child);
        const marginLeft = parseFloat(styles.marginLeft);
        const marginRight = parseFloat(styles.marginRight);

        return acc + (child as HTMLElement).offsetWidth + marginLeft + marginRight;
      }, 0);

      if (!childrenWidth) {
        setClonedChildren(children);
        return;
      }

      const repeatCount = Math.max(2, Math.ceil(carouselWidth / childrenWidth) * 2);
      const nextChildren = Array.from({ length: repeatCount }).flatMap((_, groupIndex) =>
        sourceChildren.map((child, childIndex) =>
          React.isValidElement(child) ? (
            React.cloneElement(child, { key: `cloned-${groupIndex}-${childIndex}` })
          ) : (
            <React.Fragment key={`cloned-${groupIndex}-${childIndex}`}>{child}</React.Fragment>
          ),
        ),
      );

      setClonedChildren(nextChildren);
    };

    syncChildren();

    const resizeObserver = new ResizeObserver(syncChildren);
    resizeObserver.observe(carousel);

    return () => {
      resizeObserver.disconnect();
    };
  }, [children]);

  React.useEffect(() => {
    const track = trackRef.current;

    if (!track || speed <= 0) return;

    let animationFrameId: number | null = null;
    let position = 0;
    let prevTime = performance.now();

    const animate = (currTime: number) => {
      if (document.hidden) {
        prevTime = currTime;
        animationFrameId = requestAnimationFrame(animate);
        return;
      }

      const deltaTime = currTime - prevTime;

      prevTime = currTime;
      position -= (speed * deltaTime) / 1000;

      if (Math.abs(position) >= track.offsetWidth / 2) {
        position = 0;
      }

      track.style.transform = `translate3d(${position}px, 0, 0)`;
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [speed]);

  return (
    <div ref={carouselRef} className={cn("w-full overflow-hidden", className)} {...props}>
      <div ref={trackRef} className={cn("w-max will-change-transform", trackClassName)}>
        {clonedChildren}
      </div>
    </div>
  );
}

export { InfiniteCarousel };
