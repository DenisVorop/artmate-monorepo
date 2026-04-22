import {
  BookOpen,
  CreditCard,
  Palette,
  RefreshCw,
  ShoppingBag,
  Truck,
  type LucideIcon,
} from "lucide-react";

export type FaqItem = {
  question: string;
  answer: string;
};

export type FaqSection = {
  id: string;
  icon: LucideIcon;
  label: string;
  tone: string;
  items: FaqItem[];
};

export const faqSections = [
  {
    id: "order",
    icon: ShoppingBag,
    label: "Заказы и оплата",
    tone: "bg-rose-50 text-rose-600 ring-rose-200/70",
    items: [
      {
        question: "Как оформить заказ?",
        answer:
          "Добавьте понравившиеся книги в корзину, перейдите к оформлению, заполните контактные данные и выберите способ оплаты. После подтверждения мы отправим письмо на указанный email.",
      },
      {
        question: "Какие способы оплаты доступны?",
        answer:
          "Мы принимаем оплату банковскими картами, через СБП и другие платежные методы, доступные на этапе оформления заказа.",
      },
      {
        question: "Можно ли изменить или отменить заказ?",
        answer:
          "Напишите нам как можно быстрее на artmate.official@outlook.com и укажите номер заказа. Если заказ еще не передан в доставку, мы поможем внести изменения или отменить его.",
      },
      {
        question: "Придет ли чек об оплате?",
        answer:
          "Да, электронный чек отправляется на email, который вы указали при оформлении заказа.",
      },
    ],
  },
  {
    id: "delivery",
    icon: Truck,
    label: "Доставка",
    tone: "bg-sky-50 text-sky-600 ring-sky-200/70",
    items: [
      {
        question: "В какие регионы вы доставляете?",
        answer:
          "Мы доставляем по России. Доступные способы и сроки доставки отображаются при оформлении заказа.",
      },
      {
        question: "Какие сроки доставки?",
        answer:
          "Срок зависит от региона и выбранной службы доставки. После отправки заказа мы пришлем трек-номер для отслеживания.",
      },
      {
        question: "Сколько стоит доставка?",
        answer:
          "Стоимость доставки рассчитывается при оформлении заказа. Для заказов через маркетплейсы действуют условия выбранной площадки.",
      },
      {
        question: "Как отследить мой заказ?",
        answer:
          "После передачи посылки в доставку мы отправим трек-номер на email. Его можно использовать на сайте службы доставки.",
      },
    ],
  },
  {
    id: "return",
    icon: RefreshCw,
    label: "Возврат и обмен",
    tone: "bg-amber-50 text-amber-700 ring-amber-200/70",
    items: [
      {
        question: "Как вернуть товар?",
        answer:
          "Напишите на artmate.official@outlook.com с темой «Возврат» и номером заказа. Товар должен быть не использован и сохранен в первоначальном состоянии.",
      },
      {
        question: "Когда вернут деньги?",
        answer:
          "Возврат выполняется на тот же способ оплаты после получения и проверки товара. Срок зависит от банка или платежного сервиса.",
      },
      {
        question: "Что делать, если пришел бракованный товар?",
        answer:
          "Сфотографируйте проблему и напишите нам на artmate.official@outlook.com. Мы разберемся и предложим замену или возврат.",
      },
    ],
  },
  {
    id: "product",
    icon: BookOpen,
    label: "О товарах",
    tone: "bg-emerald-50 text-emerald-700 ring-emerald-200/70",
    items: [
      {
        question: "Какая бумага используется в книгах?",
        answer:
          "Мы используем плотную бумагу 190 г/м². Она подходит для карандашей, линеров и аккуратной работы маркерами.",
      },
      {
        question: "Сколько страниц в каждой книге?",
        answer:
          "Количество иллюстраций зависит от конкретного альбома. Подробности указаны на странице товара.",
      },
      {
        question: "Какой формат книг?",
        answer: "Формат и переплет указаны в характеристиках каждого альбома на странице товара.",
      },
      {
        question: "Какие инструменты лучше всего подходят?",
        answer:
          "Подойдут цветные карандаши, линеры, гелевые ручки и маркеры. Перед активной заливкой маркерами лучше проверить материал на отдельном участке.",
      },
    ],
  },
  {
    id: "coloring",
    icon: Palette,
    label: "Раскрашивание",
    tone: "bg-violet-50 text-violet-700 ring-violet-200/70",
    items: [
      {
        question: "Я новичок, с чего начать?",
        answer:
          "Начните с простых участков и 3-4 основных цветов. Карандаши помогают мягко контролировать нажим и легко исправлять оттенки.",
      },
      {
        question: "Есть ли советы по цветовым сочетаниям?",
        answer:
          "Выбирайте одну базовую гамму и добавляйте 1-2 акцентных цвета. Так иллюстрация будет выглядеть цельно и спокойно.",
      },
      {
        question: "Можно ли отсканировать страницы?",
        answer:
          "Сканирование для личного использования допустимо. Коммерческое использование иллюстраций запрещено.",
      },
    ],
  },
  {
    id: "promocodes",
    icon: CreditCard,
    label: "Подарки и промокоды",
    tone: "bg-pink-50 text-pink-700 ring-pink-200/70",
    items: [
      {
        question: "Есть ли подарочная упаковка?",
        answer:
          "Если подарочная упаковка доступна для конкретного заказа, она появится среди опций при оформлении.",
      },
      {
        question: "Как использовать промокод?",
        answer:
          "Введите промокод в поле «Промокод» при оформлении заказа и примените его до оплаты.",
      },
      {
        question: "Промокоды суммируются?",
        answer: "Обычно промокоды не суммируются. Точные условия зависят от конкретной акции.",
      },
    ],
  },
] satisfies FaqSection[];

export function getVisibleFaqSections({
  query,
  activeSectionId,
}: {
  query: string;
  activeSectionId?: string | null;
}) {
  const normalizedQuery = query.trim().toLowerCase();

  if (normalizedQuery) {
    return faqSections
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            item.question.toLowerCase().includes(normalizedQuery) ||
            item.answer.toLowerCase().includes(normalizedQuery),
        ),
      }))
      .filter((section) => section.items.length > 0);
  }

  if (activeSectionId) {
    return faqSections.filter((section) => section.id === activeSectionId);
  }

  return faqSections;
}
