import { ArrowRight } from "lucide-react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Button } from "@/shared/ui";
import { routes } from "@/shared/constants";
import { Link } from "@/shared/ui/link";
import { SectionSubtitle, SectionTitle } from "@/shared/ui/typography";

const faqItems = [
  {
    question: "Маркеры просвечивают через страницы?",
    answer: "Нет, бумага 190 г/м² подобрана для\u00a0спиртовых и\u00a0водных маркеров.",
  },
  {
    question: "Где ещё купить книги ARTMATE?",
    answer: "На\u00a0Ozon и\u00a0Wildberries, с\u00a0доставкой через удобный пункт выдачи.",
  },
  {
    question: "Есть ли возврат?",
    answer:
      "Да, в\u00a0течение 14 дней с\u00a0момента получения, если книга не\u00a0использовалась.",
  },
];

export function Faq() {
  return (
    <section className="container py-8 md:py-12" aria-labelledby="contacts-faq-title">
      <div className="grid items-start gap-8 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] md:gap-12">
        <div className="space-y-3">
          <SectionTitle id="contacts-faq-title">
            Ещё есть вопросы?{" "}
            <span className="text-amber-500">
              Загляните <span className="whitespace-nowrap">в&nbsp;FAQ</span>
            </span>
          </SectionTitle>
          <SectionSubtitle className="text-muted-foreground">
            Собрали короткие ответы о&nbsp;материалах, доставке и&nbsp;возвратах.
          </SectionSubtitle>
          <Button asChild variant="outline" size="lg" className="mt-2">
            <Link href={routes.faq}>
              Все вопросы и&nbsp;ответы
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </div>

        <Accordion type="single" collapsible className="rounded-lg border bg-background px-4">
          {faqItems.map((item) => (
            <AccordionItem key={item.question} value={item.question}>
              <AccordionTrigger className="py-4 text-base">{item.question}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{item.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
