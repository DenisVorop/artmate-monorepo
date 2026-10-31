import { routes } from "@/shared/constants";
import { PageHero } from "@/shared/ui";

export function Hero() {
  return (
    <section className="container max-w-[1500px] py-5 md:py-8">
      <PageHero
        breadcrumbs={[{ label: "Главная", href: routes.home }, { label: "Контакты" }]}
        title={
          <>
            Мы на&nbsp;связи — <span className="text-rose-500">напишите нам</span>
          </>
        }
        description={
          <>
            Ответим на&nbsp;вопросы о&nbsp;заказах, доставке, возвратах и&nbsp;поможем выбрать
            раскраску под&nbsp;настроение.
          </>
        }
      />
    </section>
  );
}
