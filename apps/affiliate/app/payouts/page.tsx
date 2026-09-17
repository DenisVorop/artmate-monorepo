import type { Metadata } from "next";

import { buildAffiliateData } from "@/app/lib";
import { AffiliateQueryProvider } from "@/app/providers";
import { PayoutsPage } from "@/pages/payouts";

export const metadata: Metadata = { title: "Выплаты" };

export default async function Page() {
  const { ownerId, state } = await buildAffiliateData("/payouts", {
    includePayouts: true,
  });

  return (
    <AffiliateQueryProvider key={ownerId} ownerId={ownerId} state={state}>
      <PayoutsPage />
    </AffiliateQueryProvider>
  );
}
