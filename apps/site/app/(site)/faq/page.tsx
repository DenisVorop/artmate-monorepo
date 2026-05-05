import { FaqDataBuilder } from "@/app/lib/faq-data-builder";
import { FaqPage } from "@/pages/faq";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
import { createPageMetadata, FaqStructuredData } from "@/shared/lib/seo";

import { HydrationBoundary } from "@tanstack/react-query";

export const metadata = createPageMetadata("faq");

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
