import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";

import { routes } from "@/shared/constants";
import { Button } from "@/shared/ui";

import { ApplicationLink } from "./application-link";

const offerPoints = ["Заказ от 10 альбомов", "Индивидуальные условия"];

export function Hero() {
  return (
    <section
      aria-labelledby="wholesale-title"
      className="relative isolate overflow-hidden border-b border-stone-200/70 bg-[#fffdfb]"
    >
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
        <div className="relative z-2 max-w-2xl">
          <h1
            id="wholesale-title"
            className="font-heading text-[clamp(2.5rem,6.5vw,4.75rem)] leading-[0.98] font-bold tracking-[-0.055em] text-balance text-stone-950 lg:text-[clamp(3.5rem,4.2vw,4.75rem)]"
          >
            Раскраски Artmate{" "}
            <span className="bg-linear-to-r from-rose-500 via-fuchsia-500 to-orange-400 bg-clip-text text-transparent">
              оптом
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-pretty text-stone-600 md:text-lg md:leading-8">
            Для полок вашего магазина, творческих занятий и подарков. Подберём условия под ваш
            заказ.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <ApplicationLink />
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-12 bg-white/65 px-5 backdrop-blur-sm"
            >
              <Link href={routes.catalog}>
                Смотреть альбомы
                <ArrowUpRight aria-hidden />
              </Link>
            </Button>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-stone-600">
            {offerPoints.map((point) => (
              <li key={point} className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                  <Check aria-hidden className="size-3" />
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative mx-auto aspect-square w-full max-w-160">
          <div
            aria-hidden
            className="absolute inset-[10%] rounded-full border border-rose-200/60 bg-white/20"
          />
          <div
            aria-hidden
            className="absolute inset-[1%] rounded-full border border-dashed border-violet-200/65"
          />
          <Image
            src="/wholesale/glass-composition-v2.webp"
            alt=""
            fill
            preload
            sizes="(min-width: 1440px) 640px, (min-width: 1024px) 50vw, (min-width: 640px) 640px, 100vw"
            className="object-contain p-2"
          />
          <div className="absolute right-1 bottom-[8%] flex -rotate-6 items-center gap-3 rounded-2xl border border-white/90 bg-white/80 px-5 py-4 shadow-xl shadow-rose-950/10 backdrop-blur-md sm:right-5">
            <span className="text-4xl font-black tracking-tighter text-stone-950">
              10<span className="text-rose-500">+</span>
            </span>
            <span className="text-xs leading-4 font-semibold text-stone-600">
              альбомов
              <br />
              для начала
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
