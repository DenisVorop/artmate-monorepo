import { WorkshopOverview } from "@/features/workshop-overview";

export function WorkshopOverviewPage() {
  return (
    <main className="bg-[radial-gradient(circle_at_top_left,rgba(251,113,133,0.10),transparent_34rem)]">
      <div className="container py-6 md:py-10">
        <WorkshopOverview />
      </div>
    </main>
  );
}
