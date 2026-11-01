import { ColoringCollectionsCatalog } from "@/features/coloring-collections-catalog";
import { routes } from "@/shared/constants";
import { Button, CtaGradientLink, PageHero } from "@/shared/ui";

export function ColoringCollectionsPage() {
  return (
    <main className="bg-stone-100/80 text-stone-900">
      <section className="container py-5 md:py-8">
        <PageHero
          breadcrumbs={[{ label: "Главная", href: routes.home }, { label: "Цифровые версии" }]}
          title="Цифровые версии"
          description="Цветные образцы, контуры и палитры к раскраскам Artmate. Выберите альбом, затем нужную картину."
          actions={
            <Button
              asChild
              size="lg"
              className="min-h-11 border-0 bg-gradient-to-r from-rose-500 via-rose-400 to-orange-400 px-5 font-semibold text-white shadow-sm shadow-rose-500/20 hover:from-rose-500/95 hover:via-rose-400/95 hover:to-orange-400/95"
            >
              <CtaGradientLink href={routes.catalogColorings}>Выбрать альбом</CtaGradientLink>
            </Button>
          }
        />
      </section>

      <ColoringCollectionsCatalog />
    </main>
  );
}
