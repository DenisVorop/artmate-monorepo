import { MessageCircleQuestion } from "lucide-react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/shared/ui";

import { partnerFaqItems } from "../content";
import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";

export function PartnerFaq() {
  return (
    <section className="container py-16 md:py-24" aria-labelledby="partner-faq-title">
      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,0.72fr)_minmax(520px,1.28fr)] lg:gap-16">
        <Reveal>
          <div className="lg:sticky lg:top-28">
            <span className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
              <MessageCircleQuestion className="size-5" />
            </span>
            <SectionHeading
              eyebrow="FAQ"
              id="partner-faq-title"
              title={
                <>
                  Перед стартом <span className="text-rose-500">всё должно быть понятно</span>
                </>
              }
              description="Собрали главное о промокоде, заказах и процессе подключения."
            />
          </div>
        </Reveal>

        <Reveal delay={0.06}>
          <Accordion
            type="single"
            collapsible
            className="overflow-hidden rounded-[2rem] border border-stone-200/80 bg-white px-5 shadow-[0_18px_60px_rgba(75,48,60,0.06)] md:px-7"
          >
            {partnerFaqItems.map((item, index) => (
              <AccordionItem key={item.question} value={"partner-faq-" + index}>
                <AccordionTrigger className="py-5 text-base font-bold text-stone-900 hover:no-underline md:py-6 md:text-lg">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="max-w-2xl pb-5 leading-7 text-stone-600 md:pb-6">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}
