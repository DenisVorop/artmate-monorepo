import { WorkEditor } from "@/features/work-editor";

export function WorkEditorPage({ slug, number }: { slug: string; number: number }) {
  return (
    <main className="bg-[radial-gradient(circle_at_top_left,rgba(251,113,133,0.08),transparent_34rem)]">
      <div className="container py-6 md:py-10">
        <WorkEditor slug={slug} number={number} />
      </div>
    </main>
  );
}
