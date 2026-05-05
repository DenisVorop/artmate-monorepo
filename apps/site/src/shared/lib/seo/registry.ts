import { routes } from "@/shared/constants";

import type { SeoPageConfig, SeoPageKey } from "./types";

export const seoPages = {
  home: {
    title: "Artmate - раскраски по\u00a0номерам для\u00a0взрослых и\u00a0детей",
    description:
      "Раскраски по\u00a0номерам Artmate: антистресс-альбомы A4 на\u00a0спирали, 25 иллюстраций, бумага 190 г/м² и\u00a0сюжеты под\u00a0настроение.",
    canonical: routes.home,
    keywords: [
      "common",
      "products",
      "catalog",
      "раскраски по настроению",
      "творчество как стиль жизни",
    ],
    ogAlt: "Artmate - раскраски по\u00a0номерам",
  },
  catalog: {
    title: "Каталог Artmate - раскраски по\u00a0номерам и\u00a0товары для\u00a0творчества",
    description:
      "Купить раскраски по\u00a0номерам Artmate: антистресс-альбомы A4 на\u00a0спирали, 25 иллюстраций, бумага 190 г/м² и\u00a0серии под\u00a0разное настроение.",
    canonical: routes.catalog,
    keywords: ["common", "products", "catalog", "каталог раскрасок Artmate"],
    ogAlt: "Каталог Artmate - раскраски по\u00a0номерам",
  },
  product: {
    title: "Альбом Artmate - раскраска по\u00a0номерам A4 на\u00a0спирали",
    description:
      "Подробная информация об\u00a0альбоме Artmate: раскраска по\u00a0номерам A4, 25 иллюстраций, бумага 190 г/м², фото, характеристики и\u00a0отзывы.",
    canonical: routes.catalog,
    keywords: ["common", "products", "catalog"],
    ogAlt: "Альбом Artmate - раскраска по\u00a0номерам",
  },
  blog: {
    title: "Блог Artmate - раскрашивание, антистресс и\u00a0творчество",
    description:
      "Советы Artmate по\u00a0раскрашиванию по\u00a0номерам: материалы, маркеры и\u00a0карандаши, цветовые сочетания, антистресс и\u00a0идеи для\u00a0творчества.",
    canonical: routes.blog,
    keywords: ["common", "blog", "products"],
  },
  contacts: {
    title: "Контакты Artmate - свяжитесь с\u00a0нами",
    description:
      "Свяжитесь с\u00a0командой Artmate по\u00a0вопросам заказов, доставки, возвратов, сотрудничества и\u00a0выбора раскрасок.",
    canonical: routes.contacts,
    keywords: ["common", "контакты Artmate", "поддержка Artmate", "Telegram Artmate"],
  },
  faq: {
    title: "FAQ Artmate - ответы на\u00a0частые вопросы",
    description:
      "Ответы на\u00a0частые вопросы Artmate о\u00a0заказах, оплате, доставке, возвратах, книгах и\u00a0раскрашивании.",
    canonical: routes.faq,
    keywords: [
      "common",
      "products",
      "blog",
      "вопросы о раскрасках Artmate",
      "как раскрашивать Artmate",
    ],
  },
  paymentAndDelivery: {
    title: "Оплата и доставка - Artmate",
    description:
      "Как оформить заказ Artmate, оплатить его онлайн и получить доставку в удобный пункт выдачи.",
    canonical: routes.paymentAndDelivery,
    keywords: [
      "common",
      "доставка раскрасок Artmate",
      "оплата заказа Artmate",
      "пункт выдачи заказа",
    ],
  },
  account: {
    title: "Личный кабинет - Artmate",
    description: "Личный кабинет покупателя Artmate с профилем и заказами.",
    noindex: true,
  },
  auth: {
    title: "Вход и регистрация - Artmate",
    description: "Вход и регистрация в аккаунт Artmate.",
    noindex: true,
  },
  cart: {
    title: "Корзина - Artmate",
    description: "Корзина товаров Artmate.",
    noindex: true,
  },
  checkout: {
    title: "Оформление заказа - Artmate",
    description: "Оформление доставки и оплаты заказа Artmate.",
    noindex: true,
  },
  checkoutSuccess: {
    title: "Заказ оформлен - Artmate",
    description: "Подтверждение оплаты заказа Artmate.",
    noindex: true,
  },
} satisfies Record<SeoPageKey, SeoPageConfig>;
