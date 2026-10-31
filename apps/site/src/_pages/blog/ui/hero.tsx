import { routes } from "@/shared/constants";
import { PageHero } from "@/shared/ui";

export function Hero() {
  return (
    <section className="container py-5 md:py-8">
      <div className="mx-auto max-w-4xl">
        <PageHero
          breadcrumbs={[{ label: "Главная", href: routes.home }, { label: "Блог" }]}
          title={
            <>
              Вдохновение и&nbsp;<span className="text-rose-500">советы</span>
            </>
          }
          description={
            <>
              Техники раскрашивания, обзоры инструментов, арт-терапия и&nbsp;идеи
              для&nbsp;творческого хобби.
            </>
          }
        />
      </div>
    </section>
  );
}
