export type ProductCategory = {
  id: string;
  title: string;
  slug: string;
  image: string;
};

export type Product = {
  id: string;
  title: string;
  slug: string;
  price: number;
  category: string;
  categoryId: string;
  image: string;
  images: string[];
  description: string;
  bestseller: boolean;
};

export const PRODUCT_SPECS = [
  "Формат А4 (210 x 297 мм)",
  "25 уникальных сегментированных иллюстраций",
  "Премиальная бумага 190 г/м²",
  "Металлическая спираль, раскрытие на 180°",
  "Страницы с перфорацией для легкого отрыва",
] as const;

export const PRODUCT_HOW_IT_WORKS =
  "Каждая иллюстрация разделена на четкие сегменты: вы выбираете палитру и красите в своем темпе. Плотная бумага не пропускает чернила, подходит для спиртовых маркеров, акварели и цветных карандашей.";

export const PRODUCT_HIGHLIGHTS = [
  {
    id: "delivery",
    title: "Доставка",
    description: "Бесплатная доставка по России",
  },
  {
    id: "paper",
    title: "Бумага",
    description: "Плотность 190 г/м², листы не просвечивают",
  },
  {
    id: "print",
    title: "Печать",
    description: "Односторонняя печать для комфортного раскрашивания",
  },
] as const;

export const CATEGORIES = [
  {
    id: "cats",
    title: "Котики",
    slug: "kotiki",
    image: "https://images.unsplash.com/photo-1605011368428-e1d0835ff5ec?w=800&q=80",
  },
  {
    id: "landscapes",
    title: "Пейзажи",
    slug: "peizaji",
    image: "https://images.unsplash.com/photo-1683143726497-a097780bab5a?w=800&q=80",
  },
  {
    id: "flowers",
    title: "Цветы",
    slug: "cvety",
    image: "https://images.unsplash.com/photo-1545491221-95e2bc86d4ba?w=800&q=80",
  },
  {
    id: "pop-art",
    title: "Поп-арт",
    slug: "pop-art",
    image: "https://images.unsplash.com/photo-1637703335900-4b9f4ac8a606?w=800&q=80",
  },
  {
    id: "anime",
    title: "Аниме",
    slug: "anime",
    image: "https://images.unsplash.com/photo-1771366629899-2b695442ad31?w=800&q=80",
  },
  {
    id: "city",
    title: "Город",
    slug: "gorod",
    image: "https://images.unsplash.com/photo-1604952703578-8ae924053711?w=800&q=80",
  },
] satisfies ProductCategory[];

export const PRODUCTS = [
  {
    id: "1",
    title: "Кошачьи Сны. Том 1",
    slug: "koshachi-sny-tom-1",
    price: 890,
    category: "Котики",
    categoryId: "cats",
    description:
      "Альбом формата А4 на спирали с 25 детально сегментированными иллюстрациями котов. Идеально для маркеров и акварели.",
    image: "https://images.unsplash.com/photo-1605011368428-e1d0835ff5ec?w=800&q=80",
    images: [
      "https://images.unsplash.com/photo-1605011368428-e1d0835ff5ec?w=1080&q=80",
      "https://images.unsplash.com/photo-1612760721786-a42eb89aba02?w=1080&q=80",
      "https://images.unsplash.com/photo-1675917209877-843fb4c351a3?w=1080&q=80",
      "https://images.unsplash.com/photo-1761034036989-24640be78e90?w=1080&q=80",
    ],
    bestseller: true,
  },
  {
    id: "2",
    title: "Ботаническая Гармония",
    slug: "botanicheskaya-garmoniya",
    price: 790,
    category: "Цветы",
    categoryId: "flowers",
    description:
      "Найдите покой в 25 цветочных паттернах. Плотные страницы, не пропускающие чернила, идеальны для спиртовых маркеров и цветных карандашей.",
    image: "https://images.unsplash.com/photo-1545491221-95e2bc86d4ba?w=800&q=80",
    images: [
      "https://images.unsplash.com/photo-1545491221-95e2bc86d4ba?w=1080&q=80",
      "https://images.unsplash.com/photo-1649089473160-91a7b1c466d7?w=1080&q=80",
      "https://images.unsplash.com/photo-1646182967622-5598bc2d3a5b?w=1080&q=80",
      "https://images.unsplash.com/photo-1762969217477-af1c7b85db17?w=1080&q=80",
    ],
    bestseller: true,
  },
  {
    id: "3",
    title: "Безмятежные Пейзажи",
    slug: "bezmyatezhnye-peizaji",
    price: 990,
    category: "Пейзажи",
    categoryId: "landscapes",
    description:
      "Отправьтесь в красивые места. 25 больших иллюстраций А4, напечатанных на премиальной плотной бумаге.",
    image: "https://images.unsplash.com/photo-1683143726497-a097780bab5a?w=800&q=80",
    images: [
      "https://images.unsplash.com/photo-1683143726497-a097780bab5a?w=1080&q=80",
      "https://images.unsplash.com/photo-1762114974430-cdd69150c20f?w=1080&q=80",
      "https://images.unsplash.com/photo-1713815539148-82d312e40d57?w=1080&q=80",
      "https://images.unsplash.com/photo-1768471126011-2e2002832826?w=1080&q=80",
    ],
    bestseller: false,
  },
  {
    id: "4",
    title: "Ретро Поп-арт",
    slug: "retro-pop-art",
    price: 890,
    category: "Поп-арт",
    categoryId: "pop-art",
    description: "Яркий поп-арт, сегментированный для вашего творчества. 25 страниц на спирали.",
    image: "https://images.unsplash.com/photo-1637703335900-4b9f4ac8a606?w=800&q=80",
    images: [
      "https://images.unsplash.com/photo-1637703335900-4b9f4ac8a606?w=1080&q=80",
      "https://images.unsplash.com/photo-1593532847216-85672068bef2?w=1080&q=80",
      "https://images.unsplash.com/photo-1751712699299-c5b1a3c0e762?w=1080&q=80",
      "https://images.unsplash.com/photo-1658432453341-9699bbe523de?w=1080&q=80",
    ],
    bestseller: true,
  },
  {
    id: "5",
    title: "Эстетика Аниме",
    slug: "estetika-anime",
    price: 950,
    category: "Аниме",
    categoryId: "anime",
    description: "Эстетика в стиле аниме для раскрашивания. Расслабляюще и увлекательно.",
    image: "https://images.unsplash.com/photo-1771366629899-2b695442ad31?w=800&q=80",
    images: [
      "https://images.unsplash.com/photo-1771366629899-2b695442ad31?w=1080&q=80",
      "https://images.unsplash.com/photo-1587741097323-0fdcee8b0e24?w=1080&q=80",
      "https://images.unsplash.com/photo-1689230053630-cb51e7b90fc1?w=1080&q=80",
      "https://images.unsplash.com/photo-1761034036989-24640be78e90?w=1080&q=80",
    ],
    bestseller: false,
  },
  {
    id: "6",
    title: "котики 2",
    slug: "kotiki-2",
    price: 950,
    category: "Котики",
    categoryId: "cats",
    description: "Эстетика в стиле аниме для раскрашивания. Расслабляюще и увлекательно.",
    image: "https://images.unsplash.com/photo-1771366629899-2b695442ad31?w=800&q=80",
    images: [
      "https://images.unsplash.com/photo-1771366629899-2b695442ad31?w=1080&q=80",
      "https://images.unsplash.com/photo-1587741097323-0fdcee8b0e24?w=1080&q=80",
      "https://images.unsplash.com/photo-1689230053630-cb51e7b90fc1?w=1080&q=80",
      "https://images.unsplash.com/photo-1761034036989-24640be78e90?w=1080&q=80",
    ],
    bestseller: false,
  },
] satisfies Product[];

export function getProductCategory(categoryId?: string) {
  return CATEGORIES.find((category) => category.id === categoryId);
}

export function getProductCategoryBySlug(slug?: string) {
  return CATEGORIES.find((category) => category.slug === slug);
}

export function getProductById(id: string) {
  return PRODUCTS.find((product) => product.id === id);
}

export function getProductBySlug(slug: string) {
  return PRODUCTS.find((product) => product.slug === slug);
}

export function getRelatedProducts(product: Product, limit = 4) {
  const products = PRODUCTS.filter((candidate) => candidate.id !== product.id);
  const sameCategory = products.filter((candidate) => candidate.categoryId === product.categoryId);
  const otherCategories = products.filter(
    (candidate) => candidate.categoryId !== product.categoryId,
  );
  const sameCategoryLimit =
    sameCategory.length > 0 && otherCategories.length > 0 ? Math.max(limit - 1, 0) : limit;

  return [...sameCategory.slice(0, sameCategoryLimit), ...otherCategories].slice(0, limit);
}
