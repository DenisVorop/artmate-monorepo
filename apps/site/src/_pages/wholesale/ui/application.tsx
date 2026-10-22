import { FileCheck, MessageCircle, Send } from "lucide-react";

import { WholesaleApplicationForm } from "@/features/wholesale-application";

const steps = [
  { icon: Send, title: "Ваша задача", text: "Расскажите о компании и планируемом заказе." },
  { icon: MessageCircle, title: "Наше предложение", text: "Обсудим тираж, стоимость и сроки." },
  { icon: FileCheck, title: "Согласование", text: "Уточним детали и согласуем условия заказа." },
];

export function Application() {
  return (
    <section
      id="wholesale-application"
      aria-labelledby="wholesale-application-title"
      className="scroll-mt-28 px-0 pb-20 sm:px-4 sm:pb-24 lg:pb-32"
    >
      <div className="relative container overflow-hidden bg-neutral-950 text-white shadow-2xl shadow-rose-950/10 sm:rounded-[2.5rem]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:44px_44px] opacity-25"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 -left-24 size-96 rounded-full bg-rose-500/30 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -bottom-44 size-[28rem] rounded-full bg-violet-500/25 blur-3xl"
        />
        <div className="relative grid gap-10 py-8 sm:px-8 sm:py-10 lg:grid-cols-[0.78fr_1.22fr] lg:gap-14 lg:px-12 lg:py-14 xl:px-16 xl:py-16">
          <div className="flex flex-col justify-between gap-10 lg:py-4">
            <div className="space-y-6">
              <div className="space-y-4">
                <h2
                  id="wholesale-application-title"
                  className="max-w-xl font-heading text-3xl leading-tight font-bold text-balance sm:text-4xl lg:text-5xl"
                >
                  Получите оптовые условия
                </h2>
                <p className="max-w-lg text-base leading-7 text-neutral-300 sm:text-lg">
                  Оставьте почту и расскажите, что хотите заказать. Мы свяжемся с вами и обсудим
                  детали.
                </p>
              </div>
            </div>
            <ol className="grid gap-3">
              {steps.map(({ icon: Icon, title, text }) => (
                <li
                  key={title}
                  className="flex gap-3 rounded-2xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-rose-400/25 to-orange-300/15 text-orange-200 ring-1 ring-white/10">
                    <Icon aria-hidden className="size-4.5" />
                  </span>
                  <div>
                    <h3 className="font-semibold text-white">{title}</h3>
                    <p className="mt-0.5 text-sm leading-5 text-neutral-400">{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <WholesaleApplicationForm />
        </div>
      </div>
    </section>
  );
}
