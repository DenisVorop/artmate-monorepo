import { routes } from "@/shared/constants";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/shared/ui";
import { Link } from "@/shared/ui/link";
import { SectionTitle } from "@/shared/ui/typography";

export function Faq({ collectionSlug }: { collectionSlug?: string }) {
  const items = [
    {
      question: "Это фотографии работ или цветные образцы?",
      answer: (
        <>
          В галерее — фотографии готовых работ участников. Контуры и цветные образцы Artmate
          находятся в{" "}
          <Link
            href={collectionSlug ? routes.coloringCollection(collectionSlug) : routes.colorings}
          >
            цифровых версиях раскрасок
          </Link>
          .
        </>
      ),
    },
    {
      question: "Как найти работы по моей картинке?",
      answer:
        "Выберите альбом в фильтре, затем номер картинки — тот же, что указан в альбоме. В галерее показаны только те номера, для которых участники уже опубликовали работы.",
    },
    {
      question: "Где купить альбом с понравившейся картинкой?",
      answer: (
        <>
          Откройте фотографию и нажмите «Посмотреть альбом». В карточке товара можно рассмотреть
          страницы, узнать цену и оформить заказ. Все альбомы также есть в{" "}
          <Link href={routes.catalog}>каталоге Artmate</Link>.
        </>
      ),
    },
    {
      question: "Как добавить свою работу в галерею?",
      answer: (
        <>
          Войдите в аккаунт и откройте <Link href={routes.workshop}>мастерскую</Link>. Выберите
          альбом и картинку, загрузите фотографию и опубликуйте работу. В общую галерею попадают
          работы из открытых мастерских после модерации.
        </>
      ),
    },
  ];
  return (
    <section
      aria-labelledby="gallery-faq-title"
      className="space-y-6"
    >
      <SectionTitle id="gallery-faq-title">Вопросы о галерее</SectionTitle>
      <Accordion
        type="single"
        collapsible
        className="rounded-2xl border border-stone-200 bg-white px-5 md:px-6"
      >
        {items.map((item, index) => (
          <AccordionItem key={item.question} value={String(index)}>
            <AccordionTrigger className="gap-4 py-5 text-base font-semibold">
              {item.question}
            </AccordionTrigger>
            <AccordionContent
              forceMount
              className="pb-5 text-base leading-7 text-stone-600 in-data-[state=closed]:hidden"
            >
              {item.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
