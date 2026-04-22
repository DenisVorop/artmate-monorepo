import { Badge } from "@/shared";
import { PageTitle, SectionSubtitle } from "@/shared/ui/typography";

export function Hero() {
  return (
    <section className="container py-6 md:py-8">
      <div className="grid items-end gap-4 md:grid-cols-[minmax(0,3fr)_minmax(18rem,2fr)] md:gap-8">
        <div>
          <Badge variant="secondary" className="mb-6">
            Контакты
          </Badge>
          <PageTitle className="max-w-xl">
            Мы на&nbsp;связи — <span className="text-rose-500">напишите нам</span>
          </PageTitle>
        </div>
        <SectionSubtitle className="max-w-md pb-1 md:justify-self-end">
          Ответим на&nbsp;вопросы о&nbsp;заказах, доставке, возвратах и&nbsp;поможем выбрать
          раскраску под&nbsp;настроение.
        </SectionSubtitle>
      </div>
    </section>
  );
}
