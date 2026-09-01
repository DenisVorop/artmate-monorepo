import { ArrowDownRight, BadgeCheck, MessagesSquare, Send } from "lucide-react";

import { Button, CtaGradientLink } from "@/shared/ui";

import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";

const steps = [
  {
    description: "Расскажите о себе, площадке, аудитории и формате, который хотите попробовать.",
    icon: Send,
    number: "01",
    title: "Оставьте заявку",
  },
  {
    description: "Обсудим механику промокода и распределение выгоды.",
    icon: MessagesSquare,
    number: "02",
    title: "Соберём ваш формат",
  },
  {
    description: "Получите персональный промокод и делитесь Artmate в своём стиле.",
    icon: BadgeCheck,
    number: "03",
    title: "Запускайте партнёрство",
  },
] as const;

export function Steps() {
  return (
    <section
      id="how-it-works"
      className="relative scroll-mt-24 border-y border-stone-200/70 bg-stone-950 py-16 text-white md:py-24"
      aria-labelledby="partner-steps-title"
    >
      <div aria-hidden className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-[8%] size-80 rounded-full bg-rose-500/16 blur-3xl" />
        <div className="absolute right-[4%] -bottom-32 size-96 rounded-full bg-violet-500/18 blur-3xl" />
        <div className="absolute top-0 left-0 h-full w-full [background-image:linear-gradient(to_right,rgba(255,255,255,0.2)_1px,transparent_1px)] [background-size:64px_100%] opacity-15" />
      </div>

      <div className="relative container">
        <Reveal>
          <div className="[&_h2]:text-white [&_p]:text-stone-400">
            <SectionHeading
              eyebrow="Как начать"
              id="partner-steps-title"
              title={
                <>
                  От знакомства до первого <span className="text-rose-400">промокода</span>
                </>
              }
              description="Три ясных шага, чтобы подобрать механику под вашу площадку и подготовить запуск."
            />
          </div>
        </Reveal>

        <ol className="mt-10 grid gap-4 lg:grid-cols-3 lg:gap-5">
          {steps.map(({ description, icon: Icon, number, title }, index) => (
            <li key={number}>
              <Reveal delay={index * 0.07} className="h-full">
                <article className="group relative h-full min-h-64 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.06] p-7 shadow-2xl backdrop-blur-md transition-[border-color,background-color] duration-300 hover:border-rose-400/35 hover:bg-white/[0.09]">
                  <span className="absolute top-4 right-5 font-heading text-6xl font-black text-white/[0.05]">
                    {number}
                  </span>
                  <span className="flex size-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-rose-300">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-12 font-heading text-xl font-bold text-white">{title}</h3>
                  <p className="mt-3 leading-7 text-stone-400">{description}</p>
                </article>
              </Reveal>
            </li>
          ))}
        </ol>

        <Reveal className="mt-8" delay={0.08}>
          <Button
            asChild
            size="lg"
            className="h-12 border-0 bg-linear-to-r from-rose-500 via-rose-400 to-orange-400 px-5 font-bold text-white shadow-lg shadow-rose-950/30 hover:from-rose-500 hover:via-rose-400 hover:to-orange-400"
          >
            <CtaGradientLink href="#partner-application">
              Заполнить заявку
              <ArrowDownRight className="transition-transform group-hover/button:translate-x-0.5 group-hover/button:translate-y-0.5" />
            </CtaGradientLink>
          </Button>
        </Reveal>
      </div>
    </section>
  );
}
