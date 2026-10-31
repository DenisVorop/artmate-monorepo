import { routes } from "@/shared/constants";
import { PageHero } from "@/shared/ui";

export function Hero() {
  return (
    <section className="container py-5 md:py-8">
      <div className="mx-auto max-w-4xl">
        <PageHero
          breadcrumbs={[{ label: "Главная", href: routes.home }, { label: "Помощь" }]}
          title="Часто задаваемые вопросы"
          description={
            <>
              Найдите ответ по&nbsp;теме или&nbsp;через поиск. Если нужного ответа нет, напишите нам
              в&nbsp;поддержку.
            </>
          }
        />
      </div>
    </section>
  );
}
