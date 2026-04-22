import { ArrowRight } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
  routes,
} from "@/shared";
import { Link } from "@/shared/ui/link";
import { SectionSubtitle, SectionTitle } from "@/shared/ui/typography";

const faqItems = [
  {
    question: "Маркеры просвечивают через страницы?",
    answer: "Нет, бумага 190 г/м² подобрана для спиртовых и водных маркеров.",
  },
  {
    question: "Где ещё купить книги ARTMATE?",
    answer: "На Ozon и Wildberries, с доставкой через удобный пункт выдачи.",
  },
  {
    question: "Есть ли возврат?",
    answer: "Да, в течение 14 дней с момента получения, если книга не использовалась.",
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
              Загляните <span className="whitespace-nowrap">в FAQ</span>
            </span>
          </SectionTitle>
          <SectionSubtitle className="text-muted-foreground">
            Собрали короткие ответы о материалах, доставке и возвратах.
          </SectionSubtitle>
          <Button asChild variant="outline" size="lg" className="mt-2">
            <Link href={routes.faq}>
              Все вопросы и ответы
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
