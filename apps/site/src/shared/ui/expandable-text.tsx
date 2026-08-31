"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";

import { cn } from "@/shared/lib";
import { Button } from "./button";

type ExpandableTextProps = {
  children: ReactNode;
  collapsible: boolean;
  contentClassName?: string;
};

const collapsedHeight = 144;

export function ExpandableText({ children, collapsible, contentClassName }: ExpandableTextProps) {
  const contentId = useId();
  const contentRef = useRef<HTMLDivElement>(null);
  const naturalContentRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedHeight, setExpandedHeight] = useState<number>();

  useEffect(() => {
    if (!collapsible || !isExpanded || !naturalContentRef.current) {
      return;
    }

    const content = naturalContentRef.current;
    const updateExpandedHeight = () => setExpandedHeight(content.scrollHeight);

    updateExpandedHeight();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const resizeObserver = new ResizeObserver(updateExpandedHeight);
    resizeObserver.observe(content);

    return () => resizeObserver.disconnect();
  }, [children, collapsible, isExpanded]);

  let maxHeight: string | undefined;

  if (collapsible) {
    maxHeight = `${isExpanded ? (expandedHeight ?? collapsedHeight) : collapsedHeight}px`;
  }

  const toggle = () => {
    if (!isExpanded) {
      setExpandedHeight(naturalContentRef.current?.scrollHeight);
    }

    setIsExpanded((expanded) => !expanded);
  };

  return (
    <>
      <div className="relative">
        <div
          id={contentId}
          ref={contentRef}
          style={{ maxHeight }}
          className={cn(
            contentClassName,
            collapsible &&
              "overflow-hidden transition-[max-height] duration-500 ease-in-out motion-reduce:transition-none",
          )}
        >
          <div ref={naturalContentRef}>{children}</div>
        </div>

        {collapsible && !isExpanded && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-background to-transparent" />
        )}
      </div>

      {collapsible && (
        <Button
          type="button"
          variant="outline"
          aria-controls={contentId}
          aria-expanded={isExpanded}
          onClick={toggle}
        >
          {isExpanded ? "Свернуть" : "Показать полностью"}
          {isExpanded ? (
            <ChevronUp data-icon="inline-end" />
          ) : (
            <ChevronDown data-icon="inline-end" />
          )}
        </Button>
      )}
    </>
  );
}
