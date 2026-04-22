import { Badge } from "@/shared";
import { PageTitle, SectionSubtitle } from "@/shared/ui/typography";

export function Hero() {
  return (
    <section className="container py-6 md:py-8">
      <div className="grid items-end gap-4 md:grid-cols-[minmax(0,3fr)_minmax(18rem,2fr)] md:gap-8">
        <div>
          <Badge variant="secondary" className="mb-6">
            Помощь
          </Badge>
          <PageTitle className="max-w-xl">Часто задаваемые вопросы</PageTitle>
        </div>
        <SectionSubtitle className="max-w-md pb-1 text-muted-foreground md:justify-self-end">
          Найдите ответ по&nbsp;теме или&nbsp;через поиск. Если нужного ответа нет, напишите нам
          в&nbsp;поддержку.
        </SectionSubtitle>
      </div>
    </section>
  );
}
