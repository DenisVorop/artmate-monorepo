import { Badge } from "@/shared";
import { PageTitle, SectionSubtitle } from "@/shared/ui/typography";

export function Hero() {
  return (
    <section className="container py-6 md:py-8">
      <div className="mx-auto max-w-2xl text-center">
        <Badge variant="secondary" className="mb-6">
          Помощь
        </Badge>
        <PageTitle className="mb-4">Часто задаваемые вопросы</PageTitle>
        <SectionSubtitle className="mx-auto max-w-xl text-muted-foreground">
          Найдите ответ по теме или через поиск. Если нужного ответа нет, напишите нам в поддержку.
        </SectionSubtitle>
      </div>
    </section>
  );
}
