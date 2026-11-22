import { ArrowLeft, ArrowRight, Download, ExternalLink, FileText } from "lucide-react";
import type { ReactNode } from "react";

import { companyDetails, routes } from "@/shared/constants";
import { Button, Separator } from "@/shared/ui";
import { Link } from "@/shared/ui/link";
import { PageTitle, SectionTitle } from "@/shared/ui/typography";

import { sourceLegalDocuments } from "./source-documents";
export { contestRulesRevisions } from "./source-documents";
import { PdfDocumentViewer } from "./ui/pdf-document-viewer";

export type LegalDocumentId =
  | "contestRules"
  | "contestPersonalDataConsent"
  | "contestPublicationConsent"
  | "loyaltyRules"
  | "privacyPolicy"
  | "publicOffer"
  | "userAgreement"
  | "personalDataConsent"
  | "advertisingConsent"
  | "cookiePolicy"
  | "returnPolicy"
  | "promocodes";

type LegalSection = {
  title?: string;
  paragraphs?: readonly string[];
  items?: readonly string[];
  afterItems?: readonly string[];
};

type LegalDocumentDetails = {
  title: string;
  description: string;
  href: string;
  updatedAt: string;
};

type HtmlLegalDocument = LegalDocumentDetails & {
  contentType: "html";
  sections: readonly LegalSection[];
};

type PdfLegalDocument = LegalDocumentDetails & {
  contentType: "pdf";
  fileHref: string;
};

type LegalDocument = HtmlLegalDocument | PdfLegalDocument;

const sellerName = `${companyDetails.legalName}, ИНН ${companyDetails.inn}, ${companyDetails.registrationNumberLabel} ${companyDetails.registrationNumber}`;
const legalDocumentsUpdatedAt = "04.05.2026";

export const legalDocuments = {
  contestRules: sourceLegalDocuments.contestRules,
  contestPersonalDataConsent: sourceLegalDocuments.contestPersonalDataConsent,
  contestPublicationConsent: sourceLegalDocuments.contestPublicationConsent,
  publicOffer: sourceLegalDocuments.publicOffer,
  returnPolicy: {
    contentType: "html",
    title: "Правила возврата",
    description: "Порядок отмены заказа, возврата товара и возврата денежных средств Artmate.",
    href: routes.legal.returnPolicy,
    updatedAt: legalDocumentsUpdatedAt,
    sections: [
      {
        title: "1. Отмена заказа",
        paragraphs: [
          "Если заказ еще не передан в доставку, покупатель может обратиться в поддержку и запросить отмену заказа.",
        ],
      },
      {
        title: "2. Возврат товара надлежащего качества",
        paragraphs: [
          "Возврат товара надлежащего качества осуществляется в случаях и сроки, предусмотренные законодательством РФ о защите прав потребителей и правилами дистанционной продажи.",
          "Товар должен сохранить потребительские свойства, товарный вид и подтверждение покупки, если это требуется для обработки возврата.",
        ],
      },
      {
        title: "3. Возврат товара с недостатками",
        paragraphs: [
          "Если покупатель получил товар с браком, повреждением или несоответствием заказу, необходимо направить обращение в поддержку с номером заказа, описанием проблемы и фотографиями.",
          "После проверки обращения продавец предложит замену, возврат товара или возврат денежных средств в соответствии с законом.",
        ],
      },
      {
        title: "4. Возврат денежных средств",
        paragraphs: [
          `Возврат по оплаченным заказам выполняется через ${companyDetails.paymentProvider} на тот же способ оплаты, которым был оплачен заказ.`,
          "Срок зачисления зависит от банка покупателя и платежного сервиса.",
        ],
      },
      {
        title: "5. Контакты для возврата",
        items: [
          `Email: ${companyDetails.supportEmail}`,
          `Время обработки обращений: ${companyDetails.businessHours}`,
        ],
      },
    ],
  },
  userAgreement: sourceLegalDocuments.userAgreement,
  privacyPolicy: sourceLegalDocuments.privacyPolicy,
  personalDataConsent: sourceLegalDocuments.personalDataConsent,
  cookiePolicy: sourceLegalDocuments.cookiePolicy,
  advertisingConsent: sourceLegalDocuments.advertisingConsent,
  loyaltyRules: sourceLegalDocuments.loyaltyRules,
  promocodes: {
    contentType: "html",
    title: "Правила использования промокодов",
    description: "Условия предоставления и применения скидок по промокодам Artmate.",
    href: routes.legal.promocodes,
    updatedAt: "31.08.2026",
    sections: [
      {
        title: "1. Общие положения",
        paragraphs: [
          `Промокод предоставляет скидку на товары Artmate на условиях, сообщаемых покупателю при его предоставлении. Продавец - ${sellerName}. Контакт для обращений: ${companyDetails.supportEmail}.`,
          "Эти правила применяются вместе с публичной офертой и не ограничивают права покупателя, предусмотренные законодательством Российской Федерации.",
        ],
      },
      {
        title: "2. Условия конкретного кода",
        paragraphs: [
          "Размер и вид скидки, минимальная сумма товаров, максимальная скидка, срок действия и ограничения числа применений зависят от промокода и сообщаются покупателю при его предоставлении.",
          "Отсутствие даты окончания означает, что для кода не задан конечный срок; отсутствие лимита - что соответствующее ограничение не установлено. Сроки действия указываются по московскому времени: начало включительно, окончание не включительно.",
          "Если указан лимит на аккаунт, для проверки потребуется вход в аккаунт. Одноразовый код без привязки к аккаунту может применить покупатель, первым оформивший подходящий заказ в пределах доступного лимита.",
        ],
      },
      {
        title: "3. Как рассчитывается скидка",
        paragraphs: [
          "В одном заказе применяется один промокод. Скидка рассчитывается от текущей стоимости товаров до применения промокода. Стоимость доставки не участвует в расчете скидки и минимальной суммы товаров. Процентная скидка может иметь денежный предел.",
          "Скидка распределяется между товарами пропорционально их стоимости с округлением до копейки; сумма скидок по товарам совпадает с общей скидкой заказа. Денежная выплата вместо скидки и перенос неиспользованной части фиксированной скидки в другой заказ не предусмотрены. Итоговая цена отображается до подтверждения заказа.",
          "Оформление со скидкой, обнуляющей стоимость хотя бы одной единицы товара, не поддерживается; система сообщит об этом до создания заказа. Скидка не уменьшается автоматически, товары не скрываются из чека.",
        ],
      },
      {
        title: "4. Применение и учет",
        paragraphs: [
          "Введите код в корзине или при оформлении и нажмите «Применить». Предварительная проверка кода не расходует применение и не гарантирует доступность последнего места в акции.",
          "При создании заказа система повторно проверяет условия и резервирует применение; после подтвержденной оплаты оно считается использованным. При изменении корзины условия проверяются заново. Для лимита на аккаунт учитываются оплаченные и еще зарезервированные применения этого аккаунта.",
        ],
      },
      {
        title: "5. Неоплата, отмена и возврат",
        paragraphs: [
          "При неоплате или отмене применение освобождается после подтверждения того, что платеж окончательно завершен без оплаты. Закрытие платежной страницы или локальная ошибка не означают мгновенного освобождения. Повторное применение возможно, если код по-прежнему действует и доступны его лимиты.",
          "После оплаченного заказа промокод автоматически не восстанавливается при возврате; по вопросам повторного предоставления скидки можно обратиться в поддержку.",
          "Использование промокода не отменяет предусмотренные законом права на отказ от товара, возврат и предъявление требований к его качеству. При возврате учитывается фактически оплаченная стоимость возвращаемого товара с распределенной скидкой, с учетом применимых требований законодательства. Скидка сама по себе не является основанием для отказа в возврате.",
        ],
      },
      {
        title: "6. Изменения и обращения",
        paragraphs: [
          "В оформленном заказе сохраняются примененный код, условия и фактическая скидка. Последующее редактирование кода не пересчитывает этот заказ. Новая редакция правил не изменяет условия ранее оформленных заказов и не ограничивает установленные законом права.",
          `При ошибке применения или вопросах об условиях обратитесь по адресу ${companyDetails.supportEmail} и укажите код и номер заказа, если он уже создан.`,
        ],
      },
    ],
  },
} satisfies Record<LegalDocumentId, LegalDocument>;

type LegalPageProps = { children?: ReactNode } & (
  | { documentId: LegalDocumentId }
  | { document: PdfLegalDocument }
);

export function LegalDirectoryPage() {
  return (
    <main className="bg-background">
      <section className="container py-10 md:py-14">
        <div className="mx-auto max-w-4xl">
          <PageTitle>Правовые документы</PageTitle>
          <p className="mt-4 leading-7 text-muted-foreground">
            Условия покупок, использования сайта, участия в клубе и конкурсах Artmate.
          </p>
          <nav aria-label="Правовые документы" className="mt-8 grid gap-3 sm:grid-cols-2 sm:gap-4">
            {Object.values(legalDocuments).map((document) => (
              <Button
                key={document.href}
                asChild
                variant="outline"
                className="h-auto min-h-20 justify-between gap-4 rounded-xl p-5 text-left text-base leading-6 whitespace-normal hover:border-rose-200 hover:bg-rose-50"
              >
                <Link href={document.href}>
                  <span>{document.title}</span>
                  <ArrowRight aria-hidden="true" className="size-4 text-rose-500" />
                </Link>
              </Button>
            ))}
          </nav>
        </div>
      </section>
    </main>
  );
}

export function LegalPage({ children, ...props }: LegalPageProps) {
  const document: LegalDocument =
    "document" in props ? props.document : legalDocuments[props.documentId];
  const titledSections =
    document.contentType === "html"
      ? document.sections.flatMap((section, index) =>
          section.title ? [{ index, title: section.title }] : [],
        )
      : [];

  return (
    <main className="bg-background">
      <section className="container py-10 md:py-14">
        <div className="mx-auto max-w-4xl">
          <div className="space-y-4">
            <Link
              href={routes.legal.index}
              className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-rose-500"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              Правовые документы
            </Link>
            <PageTitle className="max-w-3xl text-foreground">{document.title}</PageTitle>
            <p className="max-w-3xl leading-7 text-muted-foreground">{document.description}</p>
            <p className="text-sm text-muted-foreground">Редакция от {document.updatedAt}</p>

            {document.contentType === "pdf" && (
              <div className="flex flex-wrap gap-3 pt-2">
                <Button asChild variant="outline" size="lg">
                  <a
                    href={document.fileHref}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${document.title}: открыть PDF в новой вкладке`}
                  >
                    <FileText aria-hidden="true" />
                    Открыть PDF
                    <ExternalLink aria-hidden="true" className="ml-0.5 size-3.5 opacity-60" />
                  </a>
                </Button>
                <Button asChild variant="ghost" size="lg">
                  <a href={document.fileHref} download>
                    <Download aria-hidden="true" />
                    Скачать PDF
                  </a>
                </Button>
              </div>
            )}
          </div>

          <Separator className="my-8" />

          {document.contentType === "pdf" ? (
            <PdfDocumentViewer fileHref={document.fileHref} title={document.title} />
          ) : (
            <>
              {titledSections.length > 4 && (
                <nav
                  aria-label="Содержание документа"
                  className="mb-10 rounded-xl border bg-muted/30 p-5 sm:p-6"
                >
                  <h2 className="font-display text-lg font-semibold text-foreground">Содержание</h2>
                  <ol className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2">
                    {titledSections.map((section) => (
                      <li key={section.title}>
                        <a
                          href={`#section-${section.index + 1}`}
                          className="text-sm leading-6 text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:underline focus-visible:outline-none"
                        >
                          {section.title}
                        </a>
                      </li>
                    ))}
                  </ol>
                </nav>
              )}

              <div className="space-y-8">
                {document.sections.map((section, sectionIndex) => (
                  <section
                    key={section.title ?? `section-${sectionIndex + 1}`}
                    id={section.title ? `section-${sectionIndex + 1}` : undefined}
                    aria-label={section.title ? undefined : document.title}
                    className="scroll-mt-24 space-y-4"
                  >
                    {section.title && (
                      <SectionTitle className="text-foreground">{section.title}</SectionTitle>
                    )}

                    {section.paragraphs?.map((paragraph, paragraphIndex) => (
                      <p
                        key={`paragraph-${paragraphIndex + 1}`}
                        className="leading-7 text-muted-foreground"
                      >
                        {paragraph}
                      </p>
                    ))}

                    {section.items && (
                      <ul className="space-y-3">
                        {section.items.map((item) => (
                          <li key={item} className="flex gap-3 leading-7 text-muted-foreground">
                            <span className="mt-3 size-1.5 shrink-0 rounded-full bg-rose-400" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {section.afterItems?.map((paragraph, paragraphIndex) => (
                      <p
                        key={`after-items-${paragraphIndex + 1}`}
                        className="leading-7 text-muted-foreground"
                      >
                        {paragraph}
                      </p>
                    ))}
                  </section>
                ))}
              </div>
            </>
          )}

          {children ? <div className="mt-10 space-y-6">{children}</div> : null}

          <Separator className="my-8" />

          <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-5 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>
              По вопросам документов и заказов:{" "}
              <a
                href={`mailto:${companyDetails.supportEmail}`}
                className="font-medium text-foreground underline underline-offset-4"
              >
                {companyDetails.supportEmail}
              </a>
            </span>
            <Link
              href={
                "documentId" in props && props.documentId === "publicOffer"
                  ? routes.legal.promocodes
                  : routes.paymentAndDelivery
              }
              className="font-medium text-foreground underline"
            >
              {"documentId" in props && props.documentId === "publicOffer"
                ? "Правила использования промокодов"
                : "Оплата и доставка"}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

export function PromocodesLegalPage() {
  return (
    <LegalPage documentId="promocodes">
      <nav aria-label="Связанные правовые документы" className="flex flex-wrap gap-4 text-sm">
        <Link className="font-medium underline underline-offset-4" href={routes.legal.publicOffer}>
          Публичная оферта
        </Link>
        <Link className="font-medium underline underline-offset-4" href={routes.legal.returnPolicy}>
          Правила возврата
        </Link>
      </nav>
    </LegalPage>
  );
}
