import { FaqDataBuilder } from "@/app/lib/faq-data-builder";
import { FaqPage } from "@/pages/faq";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";

import { HydrationBoundary } from "@tanstack/react-query";

export { metadata } from "@/pages/faq/metadata";

export default async function Page() {
  const { queryClient } = await new FaqDataBuilder().withFaqSections().build();

  return (
    <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
      <FaqPage />
    </HydrationBoundary>
  );
}
