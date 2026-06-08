import type { CatalogLandingPage as CatalogLandingPageData } from "@/entities/catalog-landings";
import { CatalogLandingProducts } from "@/features/catalog-landing-products";
import { CatalogLandingsLinks } from "@/features/catalog-landings-links";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Separator,
} from "@/shared/ui";

import { Breadcrumbs } from "./ui/breadcrumbs";
import { RichText } from "./ui/rich-text";

type CatalogLandingPageProps = {
  readonly landing: CatalogLandingPageData;
};

export function CatalogLandingPage({ landing }: CatalogLandingPageProps) {
  return (
    <main className="bg-background">
      <section className="container py-10 md:py-14">
        <Breadcrumbs title={landing.h1} />
        <div className="max-w-3xl">
          <h1 className="text-4xl font-semibold tracking-normal text-foreground md:text-5xl">
            {landing.h1}
          </h1>
          <RichText className="mt-5 text-lg leading-8" html={landing.introHtml} />
        </div>
      </section>

      <div className="container">
        <Separator />
      </div>

      <CatalogLandingProducts products={landing.products} />

      {(landing.seoTitle || landing.seoHtml || landing.faqItems.length > 0) && (
        <section className="container grid gap-8 pb-14 md:pb-20">
          {landing.seoTitle || landing.seoHtml ? (
            <div>
              {landing.seoTitle ? (
                <h2 className="mb-4 text-2xl font-semibold tracking-normal text-foreground">
                  {landing.seoTitle}
                </h2>
              ) : null}
              <RichText html={landing.seoHtml} />
            </div>
          ) : null}

          {landing.faqItems.length > 0 && (
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="text-lg">FAQ</CardTitle>
              </CardHeader>
              <CardContent className="pt-1">
                <Accordion type="multiple">
                  {landing.faqItems.map((item) => (
                    <AccordionItem key={item.id} value={item.id}>
                      <AccordionTrigger className="py-4 text-base">
                        {item.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        <RichText className="text-sm leading-6" html={item.answerHtml} />
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          )}
        </section>
      )}

      <CatalogLandingsLinks currentSlug={landing.slug} />
    </main>
  );
}
