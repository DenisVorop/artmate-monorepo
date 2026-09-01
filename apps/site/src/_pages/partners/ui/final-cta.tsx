import { ArrowDownRight, Sparkles } from "lucide-react";

import { Button, CtaGradientLink } from "@/shared/ui";

import { Reveal } from "./reveal";

export function FinalCta() {
  return (
    <section className="pb-16 sm:container md:pb-24" aria-labelledby="partner-final-cta-title">
      <Reveal>
        <div className="relative isolate overflow-hidden rounded-none bg-linear-to-br from-stone-900 via-[#33232c] to-[#56283e] px-4 py-12 text-center text-white shadow-[0_30px_90px_rgba(48,31,39,0.2)] sm:rounded-[2.25rem] sm:px-6 md:px-12 md:py-16">
          <div
            aria-hidden
            className="absolute inset-0 [background-image:radial-gradient(circle_at_center,rgba(255,255,255,0.8)_1px,transparent_1px)] [mask-image:linear-gradient(to_right,transparent,black,transparent)] [background-size:24px_24px] opacity-20"
          />
          <div
            aria-hidden
            className="absolute -top-24 -left-20 size-72 rounded-full bg-rose-500/30 blur-3xl"
          />
          <div
            aria-hidden
            className="absolute -right-20 -bottom-28 size-80 rounded-full bg-orange-400/20 blur-3xl"
          />

          <div className="relative mx-auto max-w-3xl">
            <span className="mx-auto mb-5 flex size-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-rose-300 backdrop-blur-md">
              <Sparkles className="size-5" />
            </span>
            <h2
              id="partner-final-cta-title"
              className="font-heading text-3xl leading-tight font-bold text-balance md:text-5xl"
            >
              Пусть ваша следующая рекомендация станет началом партнёрства
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-pretty text-stone-300 md:text-lg">
              Расскажите о своей площадке и идее. Мы познакомимся с вашим форматом и обсудим, как
              персональный промокод Artmate может в него встроиться.
            </p>
            <Button
              asChild
              size="lg"
              className="mt-8 h-12 border-0 bg-linear-to-r from-rose-500 via-rose-400 to-orange-400 px-5 font-bold text-white shadow-lg shadow-black/25 hover:from-rose-500 hover:via-rose-400 hover:to-orange-400"
            >
              <CtaGradientLink href="#partner-application">
                Оставить заявку
                <ArrowDownRight className="transition-transform group-hover/button:translate-x-0.5 group-hover/button:translate-y-0.5" />
              </CtaGradientLink>
            </Button>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
