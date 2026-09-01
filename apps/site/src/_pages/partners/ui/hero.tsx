import Link from "next/link";
import { ArrowDownRight, Check, Sparkles } from "lucide-react";

import { Button, CtaGradientLink } from "@/shared/ui";

import { HeroOrbit } from "./hero-orbit";

const offerPoints = [
  "Персональный промокод",
  "Гибкое распределение выгоды",
  "Статистика по кодам",
];

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden border-b border-stone-200/70 bg-[#fffdfb]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,rgba(120,113,108,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(120,113,108,0.08)_1px,transparent_1px)] [mask-image:linear-gradient(to_bottom,black_35%,transparent_95%)] [background-size:32px_32px] opacity-55"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-32 size-[32rem] rounded-full bg-rose-200/35 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-12 -right-40 size-[34rem] rounded-full bg-violet-200/30 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-[28%] -bottom-48 size-[30rem] rounded-full bg-orange-200/30 blur-3xl"
      />

      <div className="relative container grid min-h-[min(820px,calc(100svh-5rem))] items-center gap-8 py-14 lg:grid-cols-[minmax(0,0.94fr)_minmax(460px,1.06fr)] lg:gap-10 lg:py-16 xl:gap-16">
        <div className="relative z-20 max-w-2xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-rose-200/80 bg-white/75 px-3 py-1.5 text-[11px] font-extrabold tracking-[0.14em] text-rose-600 uppercase shadow-sm backdrop-blur-md">
            <Sparkles className="size-3.5" />
            Партнёрская программа Artmate
          </div>

          <h1 className="font-heading text-[clamp(2.5rem,6.5vw,4.75rem)] leading-[0.98] font-bold tracking-[-0.055em] text-balance text-stone-950 lg:text-[clamp(3.5rem,4.2vw,4.75rem)]">
            Зарабатывайте,{" "}
            <span className="bg-linear-to-r from-rose-500 via-fuchsia-500 to-orange-400 bg-clip-text text-transparent">
              вдохновляя
            </span>{" "}
            на&nbsp;творчество
          </h1>

          <p className="mt-6 max-w-xl text-base leading-7 text-pretty text-stone-600 md:text-lg md:leading-8">
            Получите персональный промокод Artmate и&nbsp;сами решайте, как распределить выгоду:
            оставить большую часть как вознаграждение или&nbsp;превратить её в&nbsp;скидку для
            аудитории.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="h-12 border-0 bg-linear-to-r from-rose-500 via-rose-400 to-orange-400 px-5 font-bold text-white shadow-lg shadow-rose-300/25 hover:from-rose-500 hover:via-rose-400 hover:to-orange-400"
            >
              <CtaGradientLink href="#partner-application">
                Стать партнёром
                <ArrowDownRight className="transition-transform group-hover/button:translate-x-0.5 group-hover/button:translate-y-0.5" />
              </CtaGradientLink>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-12 bg-white/65 px-5 backdrop-blur-sm"
            >
              <Link href="#how-it-works">Как это работает</Link>
            </Button>
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-stone-600">
            {offerPoints.map((point) => (
              <li key={point} className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                  <Check className="size-3" />
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative -mx-3 sm:mx-0">
          <HeroOrbit />
        </div>
      </div>
    </section>
  );
}
