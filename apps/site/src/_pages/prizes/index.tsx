import { MyPrizes } from "@/features/prizes";
export function PrizesPage({
  view = "list",
  prizeId,
}: {
  view?: "list" | "albums" | "checkout";
  prizeId?: string;
}) {
  return (
    <main className="container min-w-0 py-8 md:py-12">
      <MyPrizes view={view} prizeId={prizeId} />
    </main>
  );
}
