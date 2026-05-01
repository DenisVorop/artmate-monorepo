"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/shared/lib";
import { Button } from "@/shared/ui";
import { SectionTitle } from "@/shared/ui/typography";
import type { Product } from "../model";

type DescriptionProps = {
  product: Product;
};

const collapsedDescriptionHeight = 144;

export function Description({ product }: DescriptionProps) {
  const descriptionRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedHeight, setExpandedHeight] = useState<number>();
  const isCollapsible = product.description.length > 700;

  useEffect(() => {
    if (!isCollapsible || !isExpanded || !descriptionRef.current) {
      return;
    }

    setExpandedHeight(descriptionRef.current.scrollHeight);
  }, [isCollapsible, isExpanded, product.description]);

  if (!product.description) {
    return null;
  }

  let descriptionMaxHeight: string | undefined;

  if (isCollapsible) {
    descriptionMaxHeight = `${
      isExpanded ? (expandedHeight ?? collapsedDescriptionHeight) : collapsedDescriptionHeight
    }px`;
  }

  const toggleDescription = () => {
    if (!isExpanded) {
      setExpandedHeight(descriptionRef.current?.scrollHeight);
    }

    setIsExpanded((expanded) => !expanded);
  };

  return (
    <section
      className="space-y-2 [overflow-anchor:none] md:space-y-4"
      aria-labelledby="product-description-title"
    >
      <SectionTitle id="product-description-title" className="text-foreground">
        Описание
      </SectionTitle>

      <div className="relative">
        <div
          ref={descriptionRef}
          style={{ maxHeight: descriptionMaxHeight }}
          className={cn(
            "whitespace-pre-wrap text-base leading-7 text-muted-foreground md:text-lg",
            "[&_ol]:my-2 [&_ol]:ml-6 [&_ol]:list-decimal [&_p]:my-2 [&_p:first-child]:mt-0 [&_ul]:my-2 [&_ul]:ml-6 [&_ul]:list-disc md:[&_ol]:my-3 md:[&_p]:my-3 md:[&_ul]:my-3",
            isCollapsible &&
              "overflow-hidden transition-[max-height] duration-500 ease-in-out motion-reduce:transition-none",
          )}
          dangerouslySetInnerHTML={{ __html: product.description }}
        />

        {isCollapsible && !isExpanded && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-background to-transparent" />
        )}
      </div>

      {isCollapsible && (
        <Button
          type="button"
          variant="outline"
          aria-expanded={isExpanded}
          onClick={toggleDescription}
        >
          {isExpanded ? "Свернуть" : "Показать полностью"}
          {isExpanded ? (
            <ChevronUp data-icon="inline-end" />
          ) : (
            <ChevronDown data-icon="inline-end" />
          )}
        </Button>
      )}
    </section>
  );
}
