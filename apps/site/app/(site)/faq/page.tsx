import { FaqDataBuilder } from "@/app/lib/faq-data-builder";
import { FaqPage } from "@/pages/faq";
import { routes } from "@/shared/constants";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
import { createPageMetadata, FaqStructuredData, Seo } from "@/shared/lib/seo";

import { HydrationBoundary } from "@tanstack/react-query";

export function generateMetadata() {
  return Seo.getMetadata({
    path: routes.faq,
    fallback: createPageMetadata("faq"),
  });
}

export default async function Page() {
  const { faqSections, queryClient } = await new FaqDataBuilder().withFaqSections().build();

  return (
    <>
      {faqSections ? <FaqStructuredData sections={faqSections.items} /> : null}
      <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
        <FaqPage />
      </HydrationBoundary>
    </>
  );
}
