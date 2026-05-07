import type { ProductHighlight } from "./products.types";

export const productSpecs = [
  "25 картин по номерам",
  "Один альбом-раскраска в комплекте",
  "Подходит для детей и взрослых",
  "Страна производства: Россия",
];

export const productHowItWorks =
  "Выберите сюжет, следуйте системе номеров и постепенно заполняйте зоны подходящими цветами. В каждой книге 25 картин, поэтому раскрашивание удобно разбить на короткие спокойные сессии.";

export const productHighlights = [
  { id: "delivery", title: "Доставка", description: "Оформление заказа через корзину сайта" },
  { id: "paper", title: "Комплект", description: "Один альбом-раскраска" },
  { id: "print", title: "Сюжеты", description: "25 картин по номерам в каждой книге" },
] satisfies ProductHighlight[];
