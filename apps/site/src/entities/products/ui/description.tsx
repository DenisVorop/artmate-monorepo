import { ExpandableText } from "@/shared/ui";
import { SectionTitle } from "@/shared/ui/typography";
import type { Product } from "../model";

type DescriptionProps = {
  product: Product;
};

export function Description({ product }: DescriptionProps) {
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

      <ExpandableText
        collapsible={isCollapsible}
        contentClassName="whitespace-pre-wrap text-base leading-7 text-muted-foreground md:text-lg [&_ol]:my-2 [&_ol]:ml-6 [&_ol]:list-decimal [&_p]:my-2 [&_p:first-child]:mt-0 [&_ul]:my-2 [&_ul]:ml-6 [&_ul]:list-disc md:[&_ol]:my-3 md:[&_p]:my-3 md:[&_ul]:my-3"
      >
        <div dangerouslySetInnerHTML={{ __html: product.description }} />
      </ExpandableText>
    </section>
  );
}
