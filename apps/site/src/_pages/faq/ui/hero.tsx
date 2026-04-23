import { Badge } from "@/shared";
import { PageTitle, SectionSubtitle } from "@/shared/ui/typography";

export function Hero() {
  return (
    <section className="container py-6 md:py-8">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 text-center md:gap-6">
        <div className="flex flex-col items-center">
          <Badge variant="secondary" className="mb-6">
            Помощь
          </Badge>
          <PageTitle className="max-w-3xl">Часто задаваемые вопросы</PageTitle>
        </div>
        <SectionSubtitle className="max-w-2xl text-muted-foreground">
          Найдите ответ по&nbsp;теме или&nbsp;через поиск. Если нужного ответа нет, напишите нам
          в&nbsp;поддержку.
        </SectionSubtitle>
      </div>
    </section>
  );
}
