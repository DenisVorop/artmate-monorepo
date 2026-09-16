import type { Metadata } from "next";

import { buildAffiliateData } from "@/app/lib";
import { AffiliateQueryProvider } from "@/app/providers";
import { OverviewPage } from "@/pages/overview";

export const metadata: Metadata = { title: "Обзор" };

export default async function Page() {
  const { ownerId, state } = await buildAffiliateData("/");

  return (
    <AffiliateQueryProvider key={ownerId} ownerId={ownerId} state={state}>
      <OverviewPage />
    </AffiliateQueryProvider>
  );
}
