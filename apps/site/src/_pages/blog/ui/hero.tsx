import { Badge } from "@/shared/ui";
import { PageTitle, SectionSubtitle } from "@/shared/ui/typography";

export function Hero() {
  return (
    <section className="container py-6 md:py-8">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 text-center md:gap-6">
        <div className="flex flex-col items-center">
          <Badge variant="secondary" className="mb-6">
            Блог ARTMATE
          </Badge>
          <PageTitle className="max-w-3xl">
            Вдохновение и&nbsp;<span className="text-rose-500">советы</span>
          </PageTitle>
        </div>
        <SectionSubtitle className="max-w-2xl text-muted-foreground">
          Техники раскрашивания, обзоры инструментов, арт-терапия и&nbsp;идеи для&nbsp;творческого
          хобби.
        </SectionSubtitle>
      </div>
    </section>
  );
}
