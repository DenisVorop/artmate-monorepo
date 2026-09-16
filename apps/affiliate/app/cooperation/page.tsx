import type { Metadata } from "next";

import { buildAffiliateData } from "@/app/lib";
import { AffiliateQueryProvider } from "@/app/providers";
import { CooperationPage } from "@/pages/cooperation";

export const metadata: Metadata = { title: "Сотрудничество" };

export default async function Page() {
  const { ownerId, state } = await buildAffiliateData("/cooperation");

  return (
    <AffiliateQueryProvider key={ownerId} ownerId={ownerId} state={state}>
      <CooperationPage />
    </AffiliateQueryProvider>
  );
}
