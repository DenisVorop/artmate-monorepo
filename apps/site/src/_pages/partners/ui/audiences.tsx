import type { LucideIcon } from "lucide-react";
import { Clapperboard, GraduationCap, Paintbrush, Store } from "lucide-react";

import { cn } from "@/shared/lib";

import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";

const audiences = [
  {
    description:
      "Показывайте процесс, делитесь техниками и превращайте творческие рекомендации в понятную партнёрскую механику.",
    icon: Paintbrush,
    title: "Художникам и авторам",
    tone: "from-rose-100/80 to-white text-rose-600",
  },
  {
    description:
      "Интегрируйте Artmate в обзоры, короткие видео, подборки, эфиры и другие привычные вашей аудитории форматы.",
    icon: Clapperboard,
    title: "Блогерам и UGC-креаторам",
    tone: "from-violet-100/80 to-white text-violet-600",
  },
  {
    description:
      "Дополняйте занятия и творческие встречи продуктами, которые легко объяснить и приятно показывать.",
    icon: GraduationCap,
    title: "Студиям и преподавателям",
    tone: "from-amber-100/80 to-white text-amber-700",
  },
  {
    description:
      "Предлагайте промокод участникам своего проекта, магазина или тематического сообщества.",
    icon: Store,
    title: "Магазинам и сообществам",
    tone: "from-orange-100/80 to-white text-orange-700",
  },
] satisfies Array<{
  description: string;
  icon: LucideIcon;
  title: string;
  tone: string;
}>;

export function Audiences() {
  return (
    <section className="container py-16 md:py-24" aria-labelledby="partner-audiences-title">
      <Reveal>
        <SectionHeading
          eyebrow="Для кого"
          id="partner-audiences-title"
          title={
            <>
              Творчество уже объединяет вас с&nbsp;аудиторией.{" "}
              <span className="text-rose-500">Добавим механику.</span>
            </>
          }
          description="Партнёрство можно встроить в привычный контент или офлайн-формат — без необходимости менять свой стиль общения."
        />
      </Reveal>

      <div className="mt-10 grid gap-4 md:grid-cols-2 lg:gap-5">
        {audiences.map(({ description, icon: Icon, title, tone }, index) => (
          <Reveal key={title} delay={index * 0.06}>
            <article className="group relative h-full overflow-hidden rounded-3xl border border-stone-200/80 bg-white p-6 shadow-[0_14px_50px_rgba(64,49,55,0.05)] transition-[border-color,box-shadow] duration-300 hover:border-rose-200 hover:shadow-[0_22px_60px_rgba(93,55,70,0.1)] md:p-8">
              <div
                aria-hidden
                className={cn(
                  "absolute -top-20 -right-16 size-56 rounded-full bg-linear-to-br opacity-65 blur-2xl transition-opacity duration-300 group-hover:opacity-90",
                  tone,
                )}
              />
              <div className="relative flex items-start gap-4">
                <span
                  className={cn(
                    "flex size-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br shadow-sm",
                    tone,
                  )}
                >
                  <Icon className="size-5" />
                </span>
                <div>
                  <h3 className="font-heading text-xl leading-snug font-bold text-stone-900">
                    {title}
                  </h3>
                  <p className="mt-3 max-w-xl leading-7 text-stone-600">{description}</p>
                </div>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
