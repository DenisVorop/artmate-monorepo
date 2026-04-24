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
  categorySlug: string;
  image: string;
  images: string[];
  description: string;
  bestseller: boolean;
};

export type ProductHighlight = {
  id: "delivery" | "paper" | "print";
  title: string;
  description: string;
};

export type ProductsData = {
  categories: ProductCategory[];
  products: Product[];
  productSpecs: string[];
  productHowItWorks: string;
  productHighlights: ProductHighlight[];
};

const categories = [
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

const byId = {
  cats: "kotiki",
  landscapes: "peizaji",
  flowers: "cvety",
  "pop-art": "pop-art",
  anime: "anime",
  city: "gorod",
} satisfies Record<ProductCategory["id"], ProductCategory["slug"]>;

const products = [
  { id: "1", title: "Кошачьи Сны. Том 1", slug: "koshachi-sny-tom-1", price: 890, category: "Котики", categoryId: "cats", categorySlug: byId.cats, description: "Альбом формата А4 на\u00a0спирали с\u00a025 детально сегментированными иллюстрациями котов. Идеально для\u00a0маркеров и\u00a0акварели.", image: "https://images.unsplash.com/photo-1605011368428-e1d0835ff5ec?w=800&q=80", images: ["https://images.unsplash.com/photo-1605011368428-e1d0835ff5ec?w=1080&q=80", "https://images.unsplash.com/photo-1612760721786-a42eb89aba02?w=1080&q=80", "https://images.unsplash.com/photo-1675917209877-843fb4c351a3?w=1080&q=80", "https://images.unsplash.com/photo-1761034036989-24640be78e90?w=1080&q=80"], bestseller: true },
  { id: "2", title: "Ботаническая Гармония", slug: "botanicheskaya-garmoniya", price: 790, category: "Цветы", categoryId: "flowers", categorySlug: byId.flowers, description: "Найдите покой в\u00a025 цветочных паттернах. Плотные страницы, не\u00a0пропускающие чернила, идеальны для\u00a0спиртовых маркеров и\u00a0цветных карандашей.", image: "https://images.unsplash.com/photo-1545491221-95e2bc86d4ba?w=800&q=80", images: ["https://images.unsplash.com/photo-1545491221-95e2bc86d4ba?w=1080&q=80", "https://images.unsplash.com/photo-1649089473160-91a7b1c466d7?w=1080&q=80", "https://images.unsplash.com/photo-1646182967622-5598bc2d3a5b?w=1080&q=80", "https://images.unsplash.com/photo-1762969217477-af1c7b85db17?w=1080&q=80"], bestseller: true },
  { id: "3", title: "Безмятежные Пейзажи", slug: "bezmyatezhnye-peizaji", price: 990, category: "Пейзажи", categoryId: "landscapes", categorySlug: byId.landscapes, description: "Отправьтесь в\u00a0красивые места. 25 больших иллюстраций А4, напечатанных на\u00a0премиальной плотной бумаге.", image: "https://images.unsplash.com/photo-1683143726497-a097780bab5a?w=800&q=80", images: ["https://images.unsplash.com/photo-1683143726497-a097780bab5a?w=1080&q=80", "https://images.unsplash.com/photo-1762114974430-cdd69150c20f?w=1080&q=80", "https://images.unsplash.com/photo-1713815539148-82d312e40d57?w=1080&q=80", "https://images.unsplash.com/photo-1768471126011-2e2002832826?w=1080&q=80"], bestseller: false },
  { id: "4", title: "Ретро Поп-арт", slug: "retro-pop-art", price: 890, category: "Поп-арт", categoryId: "pop-art", categorySlug: byId["pop-art"], description: "Яркий поп-арт, сегментированный для\u00a0вашего творчества. 25 страниц на\u00a0спирали.", image: "https://images.unsplash.com/photo-1637703335900-4b9f4ac8a606?w=800&q=80", images: ["https://images.unsplash.com/photo-1637703335900-4b9f4ac8a606?w=1080&q=80", "https://images.unsplash.com/photo-1593532847216-85672068bef2?w=1080&q=80", "https://images.unsplash.com/photo-1751712699299-c5b1a3c0e762?w=1080&q=80", "https://images.unsplash.com/photo-1658432453341-9699bbe523de?w=1080&q=80"], bestseller: true },
  { id: "5", title: "Эстетика Аниме", slug: "estetika-anime", price: 950, category: "Аниме", categoryId: "anime", categorySlug: byId.anime, description: "Эстетика в\u00a0стиле аниме для\u00a0раскрашивания. Расслабляюще и\u00a0увлекательно.", image: "https://images.unsplash.com/photo-1771366629899-2b695442ad31?w=800&q=80", images: ["https://images.unsplash.com/photo-1771366629899-2b695442ad31?w=1080&q=80", "https://images.unsplash.com/photo-1587741097323-0fdcee8b0e24?w=1080&q=80", "https://images.unsplash.com/photo-1689230053630-cb51e7b90fc1?w=1080&q=80", "https://images.unsplash.com/photo-1761034036989-24640be78e90?w=1080&q=80"], bestseller: false },
  { id: "6", title: "Котики 2", slug: "kotiki-2", price: 950, category: "Котики", categoryId: "cats", categorySlug: byId.cats, description: "Эстетика в\u00a0стиле аниме для\u00a0раскрашивания. Расслабляюще и\u00a0увлекательно.", image: "https://images.unsplash.com/photo-1771366629899-2b695442ad31?w=800&q=80", images: ["https://images.unsplash.com/photo-1771366629899-2b695442ad31?w=1080&q=80", "https://images.unsplash.com/photo-1587741097323-0fdcee8b0e24?w=1080&q=80", "https://images.unsplash.com/photo-1689230053630-cb51e7b90fc1?w=1080&q=80", "https://images.unsplash.com/photo-1761034036989-24640be78e90?w=1080&q=80"], bestseller: false },
] satisfies Product[];

const productSpecs = ["Формат А4 (210 x 297 мм)", "25 уникальных сегментированных иллюстраций", "Премиальная бумага 190 г/м²", "Металлическая спираль, раскрытие на\u00a0180°", "Страницы с\u00a0перфорацией для\u00a0легкого отрыва"];
const productHowItWorks = "Каждая иллюстрация разделена на\u00a0четкие сегменты: вы\u00a0выбираете палитру и\u00a0красите в\u00a0своем темпе. Плотная бумага не\u00a0пропускает чернила, подходит для\u00a0спиртовых маркеров, акварели и\u00a0цветных карандашей.";
const productHighlights = [
  { id: "delivery", title: "Доставка", description: "Бесплатная доставка по\u00a0России" },
  { id: "paper", title: "Бумага", description: "Плотность 190 г/м², листы не\u00a0просвечивают" },
  { id: "print", title: "Печать", description: "Односторонняя печать для\u00a0комфортного раскрашивания" },
] satisfies ProductHighlight[];

export const productsData = {
  categories,
  products,
  productSpecs,
  productHowItWorks,
  productHighlights,
} satisfies ProductsData;
