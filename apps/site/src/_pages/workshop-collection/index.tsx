import { WorkshopCollection } from "@/features/workshop-collection";

export function WorkshopCollectionPage({ slug }: { slug: string }) {
  return (
    <main className="bg-[radial-gradient(circle_at_top_left,rgba(251,113,133,0.08),transparent_34rem)]">
      <div className="container py-6 md:py-10">
        <WorkshopCollection slug={slug} />
      </div>
    </main>
  );
}
