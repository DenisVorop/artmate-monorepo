import Image from "next/image";
import { ArrowUpRight } from "lucide-react";

import { SectionTitle } from "@/shared/ui/typography";

import { ApplicationLink } from "./application-link";

export function Terms() {
  return (
    <section aria-labelledby="wholesale-terms-title" className="container pb-16 md:pb-24">
      <div className="relative grid overflow-hidden rounded-[2rem] border border-rose-200/70 bg-linear-to-br from-rose-50 via-white to-orange-50 shadow-[0_18px_60px_rgba(75,48,60,0.07)] md:grid-cols-[0.9fr_1.1fr]">
        <div className="relative min-h-72 sm:min-h-90 md:min-h-120">
          <div aria-hidden className="absolute inset-[15%] rounded-full bg-rose-200/40 blur-3xl" />
          <Image
            src="/wholesale/glass-ten.webp"
            alt=""
            fill
            sizes="(min-width: 1440px) 580px, (min-width: 768px) 45vw, 85vw"
            className="object-contain p-5 md:p-8"
          />
          <span
            aria-hidden
            className="absolute right-[10%] bottom-[12%] -rotate-6 rounded-full border border-white bg-white/75 px-5 py-2 text-sm font-bold text-stone-700 shadow-lg shadow-rose-900/5 backdrop-blur-md"
          >
            10, 20, 30…
          </span>
        </div>
        <div className="relative px-6 pt-0 pb-9 sm:px-9 md:py-14 md:pr-12 lg:py-16 lg:pr-16">
          <SectionTitle id="wholesale-terms-title" className="text-balance md:!text-[2.5rem]">
            Начните <span className="text-rose-500">с 10 штук</span>
          </SectionTitle>
          <p className="mt-5 max-w-lg leading-7 text-stone-600">
            Заказать можно от 10 альбомов — по 10, 20, 30 штук и далее.
          </p>
          <div className="my-6 h-px bg-rose-200/60" />
          <p className="max-w-lg leading-7 text-stone-600">
            Стоимость, сроки и детали обсудим индивидуально — с учётом вашего тиража и задачи.
          </p>
          <ApplicationLink className="mt-7" />
        </div>
      </div>
      <div className="mt-6 flex flex-col gap-4 rounded-3xl border border-stone-200/80 bg-white px-6 py-6 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div>
          <h3 className="font-heading text-lg font-bold text-stone-900">
            Есть идея совместного проекта?
          </h3>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Рассмотрим коллаборации и печать под вашим брендом. Опишите идею в заявке.
          </p>
        </div>
        <a
          href="#wholesale-application"
          className="inline-flex min-h-11 shrink-0 items-center gap-2 text-sm font-bold text-rose-600 underline-offset-4 hover:underline"
        >
          Рассказать об идее
          <ArrowUpRight aria-hidden className="size-4" />
        </a>
      </div>
    </section>
  );
}
