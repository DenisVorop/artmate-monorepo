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
    label: "Заказы и\u00a0оплата",
    tone: "bg-rose-50 text-rose-600 ring-rose-200/70",
    items: [
      {
        question: "Как оформить заказ?",
        answer:
          "Добавьте понравившиеся книги в\u00a0корзину, перейдите к\u00a0оформлению, заполните контактные данные и\u00a0выберите способ оплаты. После подтверждения мы\u00a0отправим письмо на\u00a0указанный email.",
      },
      {
        question: "Какие способы оплаты доступны?",
        answer:
          "Мы\u00a0принимаем оплату банковскими картами, через СБП и\u00a0другие платежные методы, доступные на\u00a0этапе оформления заказа.",
      },
      {
        question: "Можно ли\u00a0изменить или\u00a0отменить заказ?",
        answer:
          "Напишите нам как можно быстрее на\u00a0artmate.official@outlook.com и\u00a0укажите номер заказа. Если заказ еще не\u00a0передан в\u00a0доставку, мы\u00a0поможем внести изменения или\u00a0отменить его.",
      },
      {
        question: "Придет ли\u00a0чек об\u00a0оплате?",
        answer:
          "Да, электронный чек отправляется на\u00a0email, который вы\u00a0указали при\u00a0оформлении заказа.",
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
        question: "В\u00a0какие регионы вы\u00a0доставляете?",
        answer:
          "Мы\u00a0доставляем по\u00a0России. Доступные способы и\u00a0сроки доставки отображаются при\u00a0оформлении заказа.",
      },
      {
        question: "Какие сроки доставки?",
        answer:
          "Срок зависит от\u00a0региона и\u00a0выбранной службы доставки. После отправки заказа мы\u00a0пришлем трек-номер для\u00a0отслеживания.",
      },
      {
        question: "Сколько стоит доставка?",
        answer:
          "Стоимость доставки рассчитывается при\u00a0оформлении заказа. Для\u00a0заказов через маркетплейсы действуют условия выбранной площадки.",
      },
      {
        question: "Как отследить мой заказ?",
        answer:
          "После передачи посылки в\u00a0доставку мы\u00a0отправим трек-номер на\u00a0email. Его можно использовать на\u00a0сайте службы доставки.",
      },
    ],
  },
  {
    id: "return",
    icon: RefreshCw,
    label: "Возврат и\u00a0обмен",
    tone: "bg-amber-50 text-amber-700 ring-amber-200/70",
    items: [
      {
        question: "Как вернуть товар?",
        answer:
          "Напишите на\u00a0artmate.official@outlook.com с\u00a0темой «Возврат» и\u00a0номером заказа. Товар должен быть не\u00a0использован и\u00a0сохранен в\u00a0первоначальном состоянии.",
      },
      {
        question: "Когда вернут деньги?",
        answer:
          "Возврат выполняется на\u00a0тот же\u00a0способ оплаты после получения и\u00a0проверки товара. Срок зависит от\u00a0банка или\u00a0платежного сервиса.",
      },
      {
        question: "Что делать, если пришел бракованный товар?",
        answer:
          "Сфотографируйте проблему и\u00a0напишите нам на\u00a0artmate.official@outlook.com. Мы\u00a0разберемся и\u00a0предложим замену или\u00a0возврат.",
      },
    ],
  },
  {
    id: "product",
    icon: BookOpen,
    label: "О\u00a0товарах",
    tone: "bg-emerald-50 text-emerald-700 ring-emerald-200/70",
    items: [
      {
        question: "Какая бумага используется в\u00a0книгах?",
        answer:
          "Мы\u00a0используем плотную бумагу 190 г/м². Она подходит для\u00a0карандашей, линеров и\u00a0аккуратной работы маркерами.",
      },
      {
        question: "Сколько страниц в\u00a0каждой книге?",
        answer:
          "Количество иллюстраций зависит от\u00a0конкретного альбома. Подробности указаны на\u00a0странице товара.",
      },
      {
        question: "Какой формат книг?",
        answer:
          "Формат и\u00a0переплет указаны в\u00a0характеристиках каждого альбома на\u00a0странице товара.",
      },
      {
        question: "Какие инструменты лучше всего подходят?",
        answer:
          "Подойдут цветные карандаши, линеры, гелевые ручки и\u00a0маркеры. Перед активной заливкой маркерами лучше проверить материал на\u00a0отдельном участке.",
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
        question: "Я\u00a0новичок, с\u00a0чего начать?",
        answer:
          "Начните с\u00a0простых участков и\u00a03-4 основных цветов. Карандаши помогают мягко контролировать нажим и\u00a0легко исправлять оттенки.",
      },
      {
        question: "Есть ли\u00a0советы по\u00a0цветовым сочетаниям?",
        answer:
          "Выбирайте одну базовую гамму и\u00a0добавляйте 1-2 акцентных цвета. Так иллюстрация будет выглядеть цельно и\u00a0спокойно.",
      },
      {
        question: "Можно ли\u00a0отсканировать страницы?",
        answer:
          "Сканирование для\u00a0личного использования допустимо. Коммерческое использование иллюстраций запрещено.",
      },
    ],
  },
  {
    id: "promocodes",
    icon: CreditCard,
    label: "Подарки и\u00a0промокоды",
    tone: "bg-pink-50 text-pink-700 ring-pink-200/70",
    items: [
      {
        question: "Есть ли\u00a0подарочная упаковка?",
        answer:
          "Если подарочная упаковка доступна для\u00a0конкретного заказа, она появится среди опций при\u00a0оформлении.",
      },
      {
        question: "Как использовать промокод?",
        answer:
          "Введите промокод в\u00a0поле «Промокод» при\u00a0оформлении заказа и\u00a0примените его до\u00a0оплаты.",
      },
      {
        question: "Промокоды суммируются?",
        answer:
          "Обычно промокоды не\u00a0суммируются. Точные условия зависят от\u00a0конкретной акции.",
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
