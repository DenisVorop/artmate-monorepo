import { WorkEditor } from "@/features/work-editor";

export function WorkEditorPage({ slug, number }: { slug: string; number: number }) {
  return (
    <main className="bg-stone-100/80 text-stone-900">
      <div className="container max-w-5xl py-5 max-md:max-w-none md:pt-8 md:pb-14">
        <WorkEditor slug={slug} number={number} />
      </div>
    </main>
  );
}
