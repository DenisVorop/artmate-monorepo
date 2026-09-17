import { ArrowDownRight, FileSignature, Megaphone, Send, WalletCards } from "lucide-react";

import { routes } from "@/shared/constants";
import { cn } from "@/shared/lib";
import { Button, Card } from "@/shared/ui";

import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";

const steps = [
  {
    accent: "from-rose-400 to-orange-300 text-rose-200 shadow-rose-950/60",
    description: "Расскажите о себе и оставьте ссылку на блог.",
    icon: Send,
    number: "01",
    title: "Оставляете заявку",
  },
  {
    accent: "from-orange-300 to-amber-200 text-orange-200 shadow-orange-950/60",
    description: "Обсудим условия, подпишем договор и откроем вам кабинет.",
    icon: FileSignature,
    number: "02",
    title: "Подписываем договор",
  },
  {
    accent: "from-fuchsia-400 to-rose-300 text-fuchsia-200 shadow-fuchsia-950/60",
    description: "Создавайте промокоды и делитесь ими с подписчиками.",
    icon: Megaphone,
    number: "03",
    title: "Выкладываете промокоды",
  },
  {
    accent: "from-violet-400 to-fuchsia-300 text-violet-200 shadow-violet-950/60",
    description: "Следите за доходом и запрашивайте выплату в кабинете.",
    icon: WalletCards,
    number: "04",
    title: "Выводите вознаграждение",
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
                  От заявки до <span className="text-rose-400">выплаты</span>
                </>
              }
              description="Начните с заявки — мы свяжемся с вами и обсудим условия."
            />
          </div>
        </Reveal>

        <ol className="relative mt-10 grid gap-5 before:absolute before:top-8 before:bottom-8 before:left-12 before:w-px before:bg-linear-to-b before:from-rose-400/70 before:via-orange-300/45 before:to-violet-400/70 sm:grid-cols-2 sm:before:hidden lg:grid-cols-4 lg:gap-5 lg:before:top-8 lg:before:right-12 lg:before:bottom-auto lg:before:left-12 lg:before:block lg:before:h-px lg:before:w-auto lg:before:bg-linear-to-r">
          {steps.map(({ accent, description, icon: Icon, number, title }, index) => (
            <li key={number} className="relative min-w-0">
              <Reveal delay={index * 0.07} className="h-full">
                <article className="group h-full">
                  <Card className="relative h-full min-h-64 gap-0 overflow-hidden rounded-3xl bg-white/[0.055] px-6 py-6 text-white shadow-2xl ring-white/10 backdrop-blur-md transition-[background-color,box-shadow] duration-300 hover:bg-white/[0.085] hover:shadow-black/40 motion-reduce:transition-none sm:px-7 sm:py-7 lg:px-5 xl:px-7">
                    <div
                      aria-hidden
                      className={cn(
                        "absolute inset-x-0 top-0 h-px bg-linear-to-r opacity-80",
                        accent,
                      )}
                    />
                    <div className="relative flex items-center justify-between gap-4">
                      <span
                        aria-hidden
                        className={cn(
                          "relative z-10 flex size-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-stone-950 shadow-lg",
                          accent,
                        )}
                      >
                        <Icon className="size-5" />
                      </span>
                      <span
                        aria-hidden
                        className="font-heading text-5xl font-black tracking-tighter text-white/10"
                      >
                        {number}
                      </span>
                    </div>
                    <h3 className="mt-12 font-heading text-xl leading-tight font-bold text-white">
                      {title}
                    </h3>
                    <p className="mt-3 text-base leading-7 text-stone-300">{description}</p>
                  </Card>
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
            <a href={`${routes.partners}#partner-application`}>
              Заполнить заявку
              <ArrowDownRight aria-hidden />
            </a>
          </Button>
        </Reveal>
      </div>
    </section>
  );
}
