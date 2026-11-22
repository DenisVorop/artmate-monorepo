import type { ReactNode } from "react";

import { ContestDetails, ContestList } from "@/features/contests";

function ContestsLayout({ children }: { children: ReactNode }) {
  return (
    <main className="bg-background text-stone-900">
      <div className="container max-w-[1320px] space-y-7 py-5 pb-16 md:space-y-9 md:py-8 md:pb-20">
        {children}
      </div>
    </main>
  );
}

export function ContestsPage() {
  return (
    <ContestsLayout>
      <ContestList />
    </ContestsLayout>
  );
}

export function ContestPage({ slug }: { slug: string }) {
  return (
    <ContestsLayout>
      <ContestDetails slug={slug} />
    </ContestsLayout>
  );
}
