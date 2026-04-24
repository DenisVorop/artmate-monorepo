import { Badge } from "@/shared/ui";
import { PageTitle, SectionSubtitle } from "@/shared/ui/typography";

export function Hero() {
  return (
    <section className="container py-6 md:py-8">
      <div className="grid items-end gap-4 md:grid-cols-[minmax(0,3fr)_minmax(18rem,2fr)] md:gap-8">
        <div>
          <Badge variant="secondary" className="mb-6">
            Каталог
          </Badge>
          <PageTitle className="max-w-lg">
            Выберите свою раскраску <span className="text-rose-500">ARTMATE</span>
          </PageTitle>
        </div>
        <SectionSubtitle className="max-w-md pb-1 md:justify-self-end">
          Подберите сюжет под&nbsp;настроение, уровень детализации и&nbsp;любимые материалы
          для&nbsp;спокойного творческого вечера.
        </SectionSubtitle>
      </div>
    </section>
  );
}
