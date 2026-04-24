export type Review = {
  id: number;
  name: string;
  rating: 1 | 2 | 3 | 4 | 5;
  text: string;
  product: string;
};

export type ReviewStats = {
  rating: number;
  ratingLabel: string;
  reviewsLabel: string;
};

export type ReviewsData = {
  reviews: Review[];
  stats: ReviewStats;
};

const reviews = [
  { id: 1, name: "Анна К.", rating: 5, text: "Качество бумаги потрясающее. Маркеры совсем не\u00a0просвечивают!", product: "Кошачьи Сны. Том 1" },
  { id: 2, name: "Елена В.", rating: 5, text: "Такой расслабляющий способ провести вечер. Благодаря сегментированным дизайнам очень легко начать.", product: "Ботаническая Гармония" },
  { id: 3, name: "Мария С.", rating: 4, text: "Красивые иллюстрации. Мне нравится спираль, благодаря ей альбом лежит идеально ровно.", product: "Ретро Поп-арт" },
  { id: 4, name: "Ольга П.", rating: 5, text: "Брала в\u00a0подарок подруге, но\u00a0в\u00a0итоге заказала второй альбом себе. Очень аккуратная печать.", product: "Ботаническая Гармония" },
  { id: 5, name: "Ирина М.", rating: 5, text: "Листы плотные, цвета ложатся ровно. Удобно, что рисунки не\u00a0слишком мелкие.", product: "Безмятежные Пейзажи" },
  { id: 6, name: "Светлана Р.", rating: 5, text: "После работы это мой лучший способ переключиться. Спираль правда решает.", product: "Эстетика Аниме" },
] satisfies Review[];

const stats = {
  rating: 5,
  ratingLabel: "4.9",
  reviewsLabel: "4 500+ отзывов на\u00a0Ozon и\u00a0Wildberries",
} satisfies ReviewStats;

export const reviewsData = {
  reviews,
  stats,
} satisfies ReviewsData;
