import type { Metadata } from "next";

import { buildAffiliateData } from "@/app/lib";
import { AffiliateQueryProvider } from "@/app/providers";
import { CodesPage } from "@/pages/codes";

export const metadata: Metadata = { title: "Промокоды" };

export default async function Page() {
  const { ownerId, state } = await buildAffiliateData("/codes", {
    includeCodes: true,
  });

  return (
    <AffiliateQueryProvider key={ownerId} ownerId={ownerId} state={state}>
      <CodesPage />
    </AffiliateQueryProvider>
  );
}
