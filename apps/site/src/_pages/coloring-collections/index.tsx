import { ColoringCollectionsCatalog } from "@/features/coloring-collections-catalog";
import { routes } from "@/shared/constants";
import {
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/shared/ui";
import { Link } from "@/shared/ui/link";
import { PageTitle, SectionSubtitle } from "@/shared/ui/typography";

export function ColoringCollectionsPage() {
  return (
    <main className="bg-[radial-gradient(circle_at_top_left,rgba(251,113,133,0.08),transparent_34rem)]">
      <section className="container space-y-6 py-5 md:space-y-8 md:py-8">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={routes.home}>Главная</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Цифровые версии</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="grid items-end gap-4 md:grid-cols-[minmax(0,3fr)_minmax(18rem,2fr)] md:gap-8">
          <div>
            <Badge variant="secondary" className="mb-5 h-auto px-3 py-1.5 text-rose-700">
              Цифровая библиотека Artmate
            </Badge>
            <PageTitle className="max-w-3xl">
              Цифровые версии <span className="text-rose-500">ARTMATE</span>
            </PageTitle>
          </div>
          <SectionSubtitle className="max-w-md pb-1 md:justify-self-end">
            Выберите тематику и посмотрите, как каждая иллюстрация выглядит в палитре маркеров
            Artmate.
          </SectionSubtitle>
        </div>
      </section>

      <ColoringCollectionsCatalog />
    </main>
  );
}
