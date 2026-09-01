import { BadgePercent, ChartNoAxesCombined, Plus } from "lucide-react";

import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";

export function Advantages() {
  return (
    <section className="container py-16 md:py-24" aria-labelledby="partner-advantages-title">
      <Reveal>
        <SectionHeading
          align="center"
          eyebrow="Возможности"
          id="partner-advantages-title"
          title={
            <>
              Промокоды и результаты — <span className="text-rose-500">в одном кабинете</span>
            </>
          }
          description="Создавайте промокоды, настраивайте выгоду и следите за результатами каждой рекомендации."
        />
      </Reveal>

      <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-12 lg:gap-5">
        <Reveal className="lg:col-span-7">
          <article className="relative h-full min-h-72 overflow-hidden rounded-[2rem] border border-rose-200/70 bg-linear-to-br from-rose-50 via-white to-orange-50 p-7 shadow-[0_18px_60px_rgba(75,48,60,0.07)] md:p-9">
            <div
              aria-hidden
              className="absolute -right-16 -bottom-20 size-64 rounded-full border-[34px] border-rose-200/30"
            />
            <div
              aria-hidden
              className="absolute right-14 bottom-8 size-28 rounded-full border border-dashed border-orange-300/70"
            />
            <span className="flex size-12 items-center justify-center rounded-2xl bg-rose-500 text-white shadow-lg shadow-rose-200">
              <BadgePercent className="size-5" />
            </span>
            <div className="relative mt-12 max-w-md">
              <h3 className="font-heading text-2xl leading-tight font-bold text-stone-900 md:text-3xl">
                Ваши промокоды
              </h3>
              <p className="mt-3 leading-7 text-stone-600">
                Все созданные коды, их условия и результаты собраны в одном месте.
              </p>
            </div>
          </article>
        </Reveal>

        <Reveal className="lg:col-span-5" delay={0.06}>
          <article className="relative h-full min-h-72 overflow-hidden rounded-[2rem] border border-violet-200/70 bg-linear-to-br from-violet-50 via-white to-fuchsia-50 p-7 shadow-[0_18px_60px_rgba(75,48,60,0.07)] md:p-9">
            <div aria-hidden className="absolute top-8 right-8 grid grid-cols-3 gap-2 opacity-60">
              {Array.from({ length: 9 }).map((_, index) => (
                <span key={index} className="size-2 rounded-full bg-violet-300" />
              ))}
            </div>
            <span className="flex size-12 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-200">
              <Plus className="size-5" />
            </span>
            <div className="relative mt-12 max-w-sm">
              <h3 className="font-heading text-2xl leading-tight font-bold text-stone-900">
                Создавайте новые
              </h3>
              <p className="mt-3 leading-7 text-stone-600">
                Добавляйте отдельные промокоды под разные площадки и форматы.
              </p>
            </div>
          </article>
        </Reveal>

        <Reveal className="md:col-span-2 lg:col-span-12" delay={0.1}>
          <article className="grid overflow-hidden rounded-[2rem] border border-amber-200/70 bg-white shadow-[0_18px_60px_rgba(75,48,60,0.07)] md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
            <div className="flex h-full min-h-36 items-center justify-center bg-linear-to-br from-amber-100 to-orange-50 p-7 md:w-44">
              <span className="relative flex size-16 items-center justify-center rounded-[1.4rem] bg-white text-amber-700 shadow-lg shadow-amber-200/60">
                <ChartNoAxesCombined className="size-7" />
              </span>
            </div>
            <div className="p-7 md:p-8">
              <h3 className="font-heading text-2xl leading-tight font-bold text-stone-900">
                Статистика по каждому коду
              </h3>
              <p className="mt-3 max-w-2xl leading-7 text-stone-600">
                Смотрите продажи, скидки и своё вознаграждение отдельно по каждому промокоду.
              </p>
            </div>
            <div
              aria-hidden
              className="hidden pr-9 text-right font-heading text-5xl font-black text-amber-100 lg:block"
            >
              YOUR STATS
            </div>
          </article>
        </Reveal>
      </div>
    </section>
  );
}
