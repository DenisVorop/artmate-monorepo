import type { Metadata } from "next";

import { companyDetails, routes, siteConfig } from "@/shared/constants";
import { Separator } from "@/shared/ui";
import { Link } from "@/shared/ui/link";

export type LegalDocumentId =
  | "privacyPolicy"
  | "publicOffer"
  | "userAgreement"
  | "personalDataConsent"
  | "cookiePolicy"
  | "returnPolicy";

type LegalSection = {
  title: string;
  paragraphs?: string[];
  items?: string[];
};

type LegalDocument = {
  title: string;
  description: string;
  href: string;
  updatedAt: string;
  sections: LegalSection[];
};

const sellerName = `${companyDetails.legalName}, ИНН ${companyDetails.inn}, ${companyDetails.registrationNumberLabel} ${companyDetails.registrationNumber}`;

export const legalDocuments = {
  publicOffer: {
    title: "Публичная оферта",
    description:
      "Условия продажи товаров Artmate, оформления заказа, оплаты, доставки и возврата.",
    href: routes.legal.publicOffer,
    updatedAt: "26.04.2026",
    sections: [
      {
        title: "1. Общие положения",
        paragraphs: [
          `Настоящая публичная оферта определяет условия продажи товаров бренда ${companyDetails.brandName} через сайт ${siteConfig.name}. Продавец: ${sellerName}.`,
          "Оформляя заказ на сайте, покупатель подтверждает, что ознакомился с условиями оферты, политикой конфиденциальности, правилами оплаты, доставки и возврата.",
        ],
      },
      {
        title: "2. Товары и цены",
        items: [
          "На сайте размещаются наименования товаров, описания, характеристики, изображения и цены в рублях.",
          "Цена товара фиксируется на момент оформления заказа и может быть изменена только для новых заказов.",
          "Информация о наличии товара, составе заказа и итоговой стоимости отображается в корзине и на странице оформления.",
        ],
      },
      {
        title: "3. Оформление заказа",
        items: [
          "Покупатель добавляет товары в корзину, указывает контактные данные и выбирает доступный способ доставки.",
          "До оплаты покупатель проверяет состав заказа, стоимость товаров, стоимость доставки и контактные данные.",
          "Заказ считается оформленным после подтверждения формы заказа и перехода к оплате.",
        ],
      },
      {
        title: "4. Оплата",
        paragraphs: [
          `Оплата заказа проводится через ${companyDetails.paymentProvider}. После подтверждения заказа покупатель перенаправляется на защищенную платежную страницу платежного сервиса.`,
          `${companyDetails.brandName} не хранит и не обрабатывает реквизиты банковских карт. Обработка платежных данных выполняется на стороне платежного сервиса и банка-эквайера.`,
        ],
      },
      {
        title: "5. Доставка",
        paragraphs: [
          `Доставка заказов выполняется через ${companyDetails.deliveryProvider} в доступные пункты выдачи. Адрес, срок и стоимость доставки отображаются при оформлении заказа.`,
          "После передачи заказа в доставку покупателю направляется информация о статусе заказа способом, указанным при оформлении.",
        ],
      },
      {
        title: "6. Возврат и отмена",
        paragraphs: [
          "Покупатель может обратиться за отменой заказа или возвратом через контактные данные продавца. Условия возврата описаны в правилах возврата.",
          "Возврат денежных средств при успешной оплате выполняется на тот же способ оплаты, которым был оплачен заказ, если иное не предусмотрено законом или правилами платежного сервиса.",
        ],
      },
      {
        title: "7. Контакты продавца",
        items: getCompanyItems(),
      },
    ],
  },
  privacyPolicy: {
    title: "Политика конфиденциальности",
    description:
      "Правила обработки персональных данных покупателей и посетителей сайта Artmate.",
    href: routes.legal.privacyPolicy,
    updatedAt: "26.04.2026",
    sections: [
      {
        title: "1. Оператор персональных данных",
        paragraphs: [
          `Оператор персональных данных: ${sellerName}. Контакт для обращений по вопросам персональных данных: ${companyDetails.supportEmail}.`,
        ],
      },
      {
        title: "2. Какие данные обрабатываются",
        items: [
          "Имя, телефон и адрес электронной почты покупателя.",
          "Состав заказа, выбранный пункт выдачи, комментарий к заказу и история обращений.",
          "Технические данные сайта: cookie, IP-адрес, сведения о браузере, устройстве и действиях на сайте.",
          "Идентификаторы платежей и статусы операций, полученные от платежного сервиса.",
        ],
      },
      {
        title: "3. Цели обработки",
        items: [
          "Оформление, оплата, доставка и сопровождение заказов.",
          "Направление уведомлений о статусе заказа и ответов на обращения.",
          "Исполнение требований законодательства, включая учет операций и обработку возвратов.",
          "Защита сайта, заказов и пользователей от мошеннических действий.",
        ],
      },
      {
        title: "4. Передача данных",
        paragraphs: [
          `Для исполнения заказа данные могут передаваться платежному сервису ${companyDetails.paymentProvider}, ${companyDetails.acquiringProvider}, службе доставки ${companyDetails.deliveryProvider}, хостинг-провайдерам, сервисам аналитики и иным подрядчикам, необходимым для работы сайта.`,
          "Передаются только данные, необходимые для конкретной цели обработки.",
        ],
      },
      {
        title: "5. Права пользователя",
        items: [
          "Запросить сведения об обработке персональных данных.",
          "Потребовать уточнения, блокирования или удаления данных, если это допускается законом.",
          "Отозвать согласие на обработку персональных данных, направив обращение на email продавца.",
        ],
      },
      {
        title: "6. Защита данных",
        paragraphs: [
          "Продавец принимает организационные и технические меры для защиты персональных данных от неправомерного доступа, изменения, раскрытия или уничтожения.",
        ],
      },
    ],
  },
  userAgreement: {
    title: "Пользовательское соглашение",
    description: "Правила использования сайта Artmate, каталога, корзины и личного кабинета.",
    href: routes.legal.userAgreement,
    updatedAt: "26.04.2026",
    sections: [
      {
        title: "1. Использование сайта",
        paragraphs: [
          `Сайт ${companyDetails.brandName} предназначен для просмотра каталога, оформления заказов, оплаты товаров и обращения в поддержку.`,
          "Пользователь обязуется указывать достоверные данные при оформлении заказа и не использовать сайт для противоправных действий.",
        ],
      },
      {
        title: "2. Аккаунт и безопасность",
        items: [
          "Пользователь отвечает за сохранность доступа к своему аккаунту.",
          "При подозрении на несанкционированный доступ пользователь должен обратиться в поддержку.",
          "Администрация сайта может ограничить действия, похожие на автоматический подбор паролей, спам или мошеннические операции.",
        ],
      },
      {
        title: "3. Контент и интеллектуальные права",
        paragraphs: [
          `Тексты, изображения, дизайн, товарные обозначения и иные материалы сайта принадлежат ${companyDetails.brandName} или используются на законных основаниях.`,
          "Копирование материалов сайта допускается только с согласия правообладателя, если иное не предусмотрено законом.",
        ],
      },
      {
        title: "4. Заказы и платежи",
        paragraphs: [
          "Оформление и оплата заказов регулируются публичной офертой, правилами оплаты и доставки, а также правилами платежного сервиса.",
        ],
      },
      {
        title: "5. Обратная связь",
        items: getCompanyItems(),
      },
    ],
  },
  personalDataConsent: {
    title: "Согласие на обработку персональных данных",
    description:
      "Согласие покупателя на обработку персональных данных при оформлении заказа Artmate.",
    href: routes.legal.personalDataConsent,
    updatedAt: "26.04.2026",
    sections: [
      {
        title: "1. Согласие пользователя",
        paragraphs: [
          `Оставляя данные на сайте, пользователь дает ${sellerName} согласие на обработку персональных данных на условиях настоящего согласия и политики конфиденциальности.`,
        ],
      },
      {
        title: "2. Перечень данных",
        items: [
          "Фамилия и имя, если они указаны пользователем.",
          "Телефон, email, адрес или выбранный пункт выдачи.",
          "Состав заказа, комментарий к заказу, статусы оплаты и доставки.",
          "Технические данные, необходимые для работы сайта и защиты от злоупотреблений.",
        ],
      },
      {
        title: "3. Действия с данными",
        paragraphs: [
          "Пользователь соглашается на сбор, запись, систематизацию, хранение, уточнение, использование, передачу, обезличивание, блокирование и удаление персональных данных.",
        ],
      },
      {
        title: "4. Срок действия и отзыв",
        paragraphs: [
          `Согласие действует до достижения целей обработки или до его отзыва. Отозвать согласие можно, направив обращение на ${companyDetails.supportEmail}.`,
        ],
      },
    ],
  },
  cookiePolicy: {
    title: "Политика Cookie",
    description: "Информация об использовании cookie и технических данных на сайте Artmate.",
    href: routes.legal.cookiePolicy,
    updatedAt: "26.04.2026",
    sections: [
      {
        title: "1. Что такое cookie",
        paragraphs: [
          "Cookie - это небольшие файлы, которые сохраняются в браузере пользователя и помогают сайту работать корректно.",
        ],
      },
      {
        title: "2. Для чего используются cookie",
        items: [
          "Сохранение корзины и пользовательских настроек.",
          "Авторизация и защита аккаунта.",
          "Аналитика посещений и улучшение интерфейса сайта.",
          "Предотвращение технических ошибок и злоупотреблений.",
        ],
      },
      {
        title: "3. Управление cookie",
        paragraphs: [
          "Пользователь может ограничить или удалить cookie в настройках браузера. Некоторые функции сайта, включая корзину и авторизацию, могут работать некорректно без технических cookie.",
        ],
      },
    ],
  },
  returnPolicy: {
    title: "Правила возврата",
    description: "Порядок отмены заказа, возврата товара и возврата денежных средств Artmate.",
    href: routes.legal.returnPolicy,
    updatedAt: "26.04.2026",
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
          `Телефон: ${companyDetails.supportPhone}`,
          `Время обработки обращений: ${companyDetails.businessHours}`,
        ],
      },
    ],
  },
} satisfies Record<LegalDocumentId, LegalDocument>;

type LegalPageProps = {
  documentId: LegalDocumentId;
};

export function LegalPage({ documentId }: LegalPageProps) {
  const document = legalDocuments[documentId];

  return (
    <main className="bg-background">
      <section className="container py-10 md:py-14">
        <div className="mx-auto max-w-4xl">
          <div className="space-y-4">
            <p className="text-sm font-medium tracking-wide text-rose-500 uppercase">
              Правовые документы
            </p>
            <h1 className="font-display text-3xl font-bold tracking-normal text-foreground md:text-5xl">
              {document.title}
            </h1>
            <p className="max-w-3xl text-muted-foreground">{document.description}</p>
            <p className="text-sm text-muted-foreground">Редакция от {document.updatedAt}</p>
          </div>

          <Separator className="my-8" />

          <div className="space-y-8">
            {document.sections.map((section) => (
              <section key={section.title} className="space-y-4">
                <h2 className="font-display text-2xl font-semibold tracking-normal">
                  {section.title}
                </h2>

                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph} className="leading-7 text-muted-foreground">
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
              </section>
            ))}
          </div>

          <Separator className="my-8" />

          <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-5 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>По вопросам документов и заказов: {companyDetails.supportEmail}</span>
            <Link href={routes.paymentAndDelivery} className="font-medium text-foreground underline">
              Оплата и доставка
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

export function getLegalMetadata(documentId: LegalDocumentId): Metadata {
  const document = legalDocuments[documentId];
  const title = `${document.title} - ${siteConfig.name}`;

  return {
    title: {
      absolute: title,
    },
    description: document.description,
    alternates: {
      canonical: document.href,
    },
    openGraph: {
      title,
      description: document.description,
      url: document.href,
      siteName: siteConfig.name,
      locale: siteConfig.locale,
      type: "website",
      images: [
        {
          url: siteConfig.ogImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: document.description,
      images: [siteConfig.ogImage],
    },
  };
}

function getCompanyItems() {
  return [
    `Полное наименование: ${companyDetails.legalName}`,
    `ИНН: ${companyDetails.inn}`,
    `${companyDetails.registrationNumberLabel}: ${companyDetails.registrationNumber}`,
    `Юридический адрес: ${companyDetails.legalAddress}`,
    `Фактический адрес: ${companyDetails.actualAddress}`,
    `Страна регистрации: ${companyDetails.registrationCountry}`,
    `Телефон: ${companyDetails.supportPhone}`,
    `Email: ${companyDetails.supportEmail}`,
  ];
}
