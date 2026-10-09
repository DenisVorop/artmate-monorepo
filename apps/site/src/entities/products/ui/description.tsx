"use client";

import { useIsMobile } from "@/shared/lib/device";
import { ExpandableText } from "@/shared/ui";
import { SectionTitle } from "@/shared/ui/typography";
import type { Product } from "../model";
import { DetailsDrawer } from "./details-drawer";

const contentClassName =
  "whitespace-pre-wrap text-base leading-7 text-muted-foreground md:text-lg [&_ol]:my-2 [&_ol]:ml-6 [&_ol]:list-decimal [&_p]:my-2 [&_p:first-child]:mt-0 [&_ul]:my-2 [&_ul]:ml-6 [&_ul]:list-disc md:[&_ol]:my-3 md:[&_p]:my-3 md:[&_ul]:my-3";

type DescriptionProps = {
  product: Product;
};

export function Description({ product }: DescriptionProps) {
  const isMobile = useIsMobile();
  const isCollapsible = product.description.length > 700;

  if (!product.description) {
    return null;
  }

  return (
    <section
      className="space-y-2 [overflow-anchor:none] md:space-y-4"
      aria-labelledby="product-description-title"
    >
      <SectionTitle id="product-description-title" className="text-foreground">
        Описание
      </SectionTitle>

      {isMobile && isCollapsible ? (
        <>
          <div className="relative">
            <div className={`${contentClassName} max-h-36 overflow-hidden`}>
              <div dangerouslySetInnerHTML={{ __html: product.description }} />
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-background to-transparent" />
          </div>
          <DetailsDrawer
            title="Описание"
            productTitle={product.title}
            triggerLabel="Показать полностью"
          >
            <div
              className={contentClassName}
              dangerouslySetInnerHTML={{ __html: product.description }}
            />
          </DetailsDrawer>
        </>
      ) : (
        <ExpandableText collapsible={isCollapsible} contentClassName={contentClassName}>
          <div dangerouslySetInnerHTML={{ __html: product.description }} />
        </ExpandableText>
      )}
    </section>
  );
}
