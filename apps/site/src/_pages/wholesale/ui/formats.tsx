import { Gift, Paintbrush, Store } from "lucide-react";

import { SectionSubtitle, SectionTitle } from "@/shared/ui/typography";

const formats = [
  {
    title: "На полки",
    subtitle: "Для продажи",
    text: "Книжным, магазинам подарков и товаров для творчества, интернет-магазинам.",
    icon: Store,
    tone: "from-rose-100/80 to-white text-rose-600",
    glow: "bg-rose-100/70",
  },
  {
    title: "В студии",
    subtitle: "Для занятий",
    text: "Творческим студиям, мастерским и организаторам мастер-классов.",
    icon: Paintbrush,
    tone: "from-violet-100/80 to-white text-violet-600",
    glow: "bg-violet-100/70",
  },
  {
    title: "В подарок",
    subtitle: "Для компаний и событий",
    text: "Для сотрудников, клиентов и участников мероприятий — взрослым и детям.",
    icon: Gift,
    tone: "from-amber-100/80 to-white text-amber-700",
    glow: "bg-amber-100/70",
  },
] as const;

export function Formats() {
  return (
    <section
      id="wholesale-formats"
      aria-labelledby="wholesale-formats-title"
      className="container scroll-mt-28 py-16 md:py-24"
    >
      <div className="flex flex-col gap-4">
        <SectionTitle
          id="wholesale-formats-title"
          className="max-w-3xl text-balance md:!text-[2.5rem]"
        >
          Вашим покупателям. Ученикам. <span className="text-rose-500">Команде.</span>
        </SectionTitle>
        <SectionSubtitle className="max-w-2xl text-pretty text-stone-600 md:text-lg md:leading-8">
          Раскраски по номерам Artmate — для продажи, занятий и подарков.
        </SectionSubtitle>
      </div>
      <div className="mt-10 grid gap-4 md:grid-cols-3 lg:gap-5">
        {formats.map(({ title, subtitle, text, icon: Icon, tone, glow }) => (
          <article
            key={title}
            className="group relative h-full overflow-hidden rounded-3xl border border-stone-200/80 bg-white p-6 shadow-[0_14px_50px_rgba(64,49,55,0.05)] transition-[border-color,box-shadow] duration-300 hover:border-rose-200 hover:shadow-[0_22px_60px_rgba(93,55,70,0.1)] motion-reduce:transition-none md:p-8"
          >
            <div
              aria-hidden
              className={`pointer-events-none absolute -top-20 -right-16 size-56 rounded-full blur-2xl ${glow}`}
            />
            <div className="relative">
              <span
                className={`mb-8 flex size-12 items-center justify-center rounded-2xl bg-linear-to-br shadow-sm ${tone}`}
              >
                <Icon aria-hidden className="size-5" />
              </span>
              <p className="mb-2 text-[11px] font-bold tracking-[0.12em] text-stone-500 uppercase">
                {subtitle}
              </p>
              <h3 className="font-heading text-2xl leading-tight font-bold text-stone-900">
                {title}
              </h3>
              <p className="mt-3 leading-7 text-stone-600">{text}</p>
            </div>
          </article>
        ))}
      </div>
      <p className="mt-6 text-sm leading-6 text-stone-600">
        Есть другая задача? Расскажите о ней в заявке — обсудим подходящий формат.
      </p>
    </section>
  );
}
