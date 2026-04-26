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
    image: "https://basket-20.wbbasket.ru/vol3414/part341439/341439176/images/big/1.webp",
  },
  {
    id: "landscapes",
    title: "Пейзажи",
    slug: "peizazhi",
    image: "https://basket-21.wbbasket.ru/vol3625/part362516/362516234/images/big/1.webp",
  },
  {
    id: "pop-art",
    title: "Поп-арт",
    slug: "pop-art",
    image: "https://basket-24.wbbasket.ru/vol4261/part426101/426101848/images/big/1.webp",
  },
  {
    id: "city",
    title: "Город",
    slug: "gorod",
    image: "https://basket-27.wbbasket.ru/vol5072/part507212/507212193/images/big/1.webp",
  },
  {
    id: "anime",
    title: "Аниме",
    slug: "anime",
    image: "https://basket-28.wbbasket.ru/vol5236/part523638/523638625/images/big/1.webp",
  },
  {
    id: "winter",
    title: "Зима",
    slug: "zima",
    image: "https://basket-30.wbbasket.ru/vol6057/part605779/605779011/images/big/1.webp",
  },
  {
    id: "mystic-forest",
    title: "Мистический лес",
    slug: "misticheskiy-les",
    image: "https://basket-30.wbbasket.ru/vol6058/part605811/605811015/images/big/1.webp",
  },
  {
    id: "flowers",
    title: "Цветы",
    slug: "cvety",
    image: "https://basket-35.wbbasket.ru/vol7625/part762512/762512016/images/big/1.webp",
  },
  {
    id: "princesses",
    title: "Принцессы",
    slug: "printsessy",
    image: "https://basket-41.wbbasket.ru/vol9808/part980896/980896594/images/big/1.webp",
  },
  {
    id: "animals",
    title: "Животные",
    slug: "zhivotnye",
    image: "https://basket-41.wbbasket.ru/vol9781/part978180/978180831/images/big/1.webp",
  },
] satisfies ProductCategory[];

const products = [
  {
    id: "341439176",
    title: "Раскраска-антистресс по номерам, котики, 25 картин",
    slug: "raskraska-po-nomeram-kotiki",
    price: 1649,
    category: "Котики",
    categoryId: "cats",
    categorySlug: "kotiki",
    image: "https://basket-20.wbbasket.ru/vol3414/part341439/341439176/images/big/1.webp",
    images: [
      "https://basket-20.wbbasket.ru/vol3414/part341439/341439176/images/big/1.webp",
      "https://basket-20.wbbasket.ru/vol3414/part341439/341439176/images/big/2.webp",
      "https://basket-20.wbbasket.ru/vol3414/part341439/341439176/images/big/3.webp",
      "https://basket-20.wbbasket.ru/vol3414/part341439/341439176/images/big/4.webp",
      "https://basket-20.wbbasket.ru/vol3414/part341439/341439176/images/big/5.webp",
      "https://basket-20.wbbasket.ru/vol3414/part341439/341439176/images/big/6.webp",
    ],
    description:
      "Раскраска по номерам «Котики» — создайте уют и радость вместе с милыми пушистиками.",
    bestseller: true,
  },
  {
    id: "362516234",
    title: "Раскраска по номерам, пейзажи, 25 картин",
    slug: "raskraska-po-nomeram-peyzazhi",
    price: 4999,
    category: "Пейзажи",
    categoryId: "landscapes",
    categorySlug: "peizazhi",
    image: "https://basket-21.wbbasket.ru/vol3625/part362516/362516234/images/big/1.webp",
    images: [
      "https://basket-21.wbbasket.ru/vol3625/part362516/362516234/images/big/1.webp",
      "https://basket-21.wbbasket.ru/vol3625/part362516/362516234/images/big/2.webp",
      "https://basket-21.wbbasket.ru/vol3625/part362516/362516234/images/big/3.webp",
      "https://basket-21.wbbasket.ru/vol3625/part362516/362516234/images/big/4.webp",
      "https://basket-21.wbbasket.ru/vol3625/part362516/362516234/images/big/5.webp",
      "https://basket-21.wbbasket.ru/vol3625/part362516/362516234/images/big/6.webp",
    ],
    description: "Раскраска по номерам «Пейзажи» - создавайте атмосферу уюта и вдохновения.",
    bestseller: true,
  },
  {
    id: "426101848",
    title: "Раскраска по номерам, поп-арт, 25 картин",
    slug: "raskraska-po-nomeram-popart",
    price: 0,
    category: "Поп-арт",
    categoryId: "pop-art",
    categorySlug: "pop-art",
    image: "https://basket-24.wbbasket.ru/vol4261/part426101/426101848/images/big/1.webp",
    images: [
      "https://basket-24.wbbasket.ru/vol4261/part426101/426101848/images/big/1.webp",
      "https://basket-24.wbbasket.ru/vol4261/part426101/426101848/images/big/2.webp",
      "https://basket-24.wbbasket.ru/vol4261/part426101/426101848/images/big/3.webp",
      "https://basket-24.wbbasket.ru/vol4261/part426101/426101848/images/big/4.webp",
      "https://basket-24.wbbasket.ru/vol4261/part426101/426101848/images/big/5.webp",
      "https://basket-24.wbbasket.ru/vol4261/part426101/426101848/images/big/6.webp",
    ],
    description:
      "Раскраска по номерам «Поп-арт» — погрузитесь в мир ярких эмоций и творческой свободы.",
    bestseller: false,
  },
  {
    id: "507212193",
    title: "Раскраска по номерам, город, 25 картин",
    slug: "raskraska-po-nomeram-gorod",
    price: 4999,
    category: "Город",
    categoryId: "city",
    categorySlug: "gorod",
    image: "https://basket-27.wbbasket.ru/vol5072/part507212/507212193/images/big/1.webp",
    images: [
      "https://basket-27.wbbasket.ru/vol5072/part507212/507212193/images/big/1.webp",
      "https://basket-27.wbbasket.ru/vol5072/part507212/507212193/images/big/2.webp",
      "https://basket-27.wbbasket.ru/vol5072/part507212/507212193/images/big/3.webp",
      "https://basket-27.wbbasket.ru/vol5072/part507212/507212193/images/big/4.webp",
      "https://basket-27.wbbasket.ru/vol5072/part507212/507212193/images/big/5.webp",
      "https://basket-27.wbbasket.ru/vol5072/part507212/507212193/images/big/6.webp",
    ],
    description:
      "Раскраска по номерам «Город» — почувствуйте атмосферу уютного города в каждом штрихе.",
    bestseller: false,
  },
  {
    id: "523638625",
    title: "Раскраска по номерам, аниме, 25 картин",
    slug: "raskraska-po-nomeram-anime",
    price: 4999,
    category: "Аниме",
    categoryId: "anime",
    categorySlug: "anime",
    image: "https://basket-28.wbbasket.ru/vol5236/part523638/523638625/images/big/1.webp",
    images: [
      "https://basket-28.wbbasket.ru/vol5236/part523638/523638625/images/big/1.webp",
      "https://basket-28.wbbasket.ru/vol5236/part523638/523638625/images/big/2.webp",
      "https://basket-28.wbbasket.ru/vol5236/part523638/523638625/images/big/3.webp",
      "https://basket-28.wbbasket.ru/vol5236/part523638/523638625/images/big/4.webp",
      "https://basket-28.wbbasket.ru/vol5236/part523638/523638625/images/big/5.webp",
      "https://basket-28.wbbasket.ru/vol5236/part523638/523638625/images/big/6.webp",
    ],
    description: "Раскраска по номерам «Аниме» — мир ярких эмоций и любимых персонажей.",
    bestseller: false,
  },
  {
    id: "605779011",
    title: "Раскраска по номерам, зима, 25 картин",
    slug: "raskraska-po-nomeram-zima",
    price: 4999,
    category: "Зима",
    categoryId: "winter",
    categorySlug: "zima",
    image: "https://basket-30.wbbasket.ru/vol6057/part605779/605779011/images/big/1.webp",
    images: [
      "https://basket-30.wbbasket.ru/vol6057/part605779/605779011/images/big/1.webp",
      "https://basket-30.wbbasket.ru/vol6057/part605779/605779011/images/big/2.webp",
      "https://basket-30.wbbasket.ru/vol6057/part605779/605779011/images/big/3.webp",
      "https://basket-30.wbbasket.ru/vol6057/part605779/605779011/images/big/4.webp",
      "https://basket-30.wbbasket.ru/vol6057/part605779/605779011/images/big/5.webp",
      "https://basket-30.wbbasket.ru/vol6057/part605779/605779011/images/big/6.webp",
    ],
    description: "Раскраска по номерам «Зима» — почувствуйте волшебство морозных дней.",
    bestseller: false,
  },
  {
    id: "605811015",
    title: "Раскраска по номерам, по пикселям, загадочный лес, 25 картин",
    slug: "pixel-raskraska-po-nomeram-mystic-forest",
    price: 4999,
    category: "Мистический лес",
    categoryId: "mystic-forest",
    categorySlug: "misticheskiy-les",
    image: "https://basket-30.wbbasket.ru/vol6058/part605811/605811015/images/big/1.webp",
    images: [
      "https://basket-30.wbbasket.ru/vol6058/part605811/605811015/images/big/1.webp",
      "https://basket-30.wbbasket.ru/vol6058/part605811/605811015/images/big/2.webp",
      "https://basket-30.wbbasket.ru/vol6058/part605811/605811015/images/big/3.webp",
      "https://basket-30.wbbasket.ru/vol6058/part605811/605811015/images/big/4.webp",
      "https://basket-30.wbbasket.ru/vol6058/part605811/605811015/images/big/5.webp",
    ],
    description:
      "Пиксельная раскраска по номерам «Загадочный лес» — окунитесь в мир тайн и волшебства.",
    bestseller: false,
  },
  {
    id: "762512016",
    title: "Раскраска по номерам, цветы, 25 картин",
    slug: "raskraska-po-nomeram-flowers",
    price: 4999,
    category: "Цветы",
    categoryId: "flowers",
    categorySlug: "cvety",
    image: "https://basket-35.wbbasket.ru/vol7625/part762512/762512016/images/big/1.webp",
    images: [
      "https://basket-35.wbbasket.ru/vol7625/part762512/762512016/images/big/1.webp",
      "https://basket-35.wbbasket.ru/vol7625/part762512/762512016/images/big/2.webp",
      "https://basket-35.wbbasket.ru/vol7625/part762512/762512016/images/big/3.webp",
      "https://basket-35.wbbasket.ru/vol7625/part762512/762512016/images/big/4.webp",
      "https://basket-35.wbbasket.ru/vol7625/part762512/762512016/images/big/5.webp",
    ],
    description: "Раскраска по номерам «Цветы» — нежность, спокойствие и вдохновение.",
    bestseller: true,
  },
  {
    id: "762518870",
    title: "Раскраска по номерам, котики, 25 картин",
    slug: "raskraska-po-nomeram-kotiki-2",
    price: 4999,
    category: "Котики",
    categoryId: "cats",
    categorySlug: "kotiki",
    image: "https://basket-35.wbbasket.ru/vol7625/part762518/762518870/images/big/1.webp",
    images: [
      "https://basket-35.wbbasket.ru/vol7625/part762518/762518870/images/big/1.webp",
      "https://basket-35.wbbasket.ru/vol7625/part762518/762518870/images/big/2.webp",
      "https://basket-35.wbbasket.ru/vol7625/part762518/762518870/images/big/3.webp",
      "https://basket-35.wbbasket.ru/vol7625/part762518/762518870/images/big/4.webp",
      "https://basket-35.wbbasket.ru/vol7625/part762518/762518870/images/big/5.webp",
    ],
    description: "Раскраска по номерам «Котики» — уют, настроение и творчество.",
    bestseller: true,
  },
  {
    id: "980896594",
    title: "Раскраска по номерам, принцессы, 25 картин",
    slug: "raskraska-po-nomeram-princesses",
    price: 4999,
    category: "Принцессы",
    categoryId: "princesses",
    categorySlug: "printsessy",
    image: "https://basket-41.wbbasket.ru/vol9808/part980896/980896594/images/big/1.webp",
    images: [
      "https://basket-41.wbbasket.ru/vol9808/part980896/980896594/images/big/1.webp",
      "https://basket-41.wbbasket.ru/vol9808/part980896/980896594/images/big/2.webp",
      "https://basket-41.wbbasket.ru/vol9808/part980896/980896594/images/big/3.webp",
      "https://basket-41.wbbasket.ru/vol9808/part980896/980896594/images/big/4.webp",
      "https://basket-41.wbbasket.ru/vol9808/part980896/980896594/images/big/5.webp",
    ],
    description: "Раскраска по номерам «Принцессы» — волшебство, красота и творчество.",
    bestseller: false,
  },
  {
    id: "978180831",
    title: "Раскраска по номерам, животные, 25 картин",
    slug: "raskraska-po-nomeram-zhivotnie",
    price: 4999,
    category: "Животные",
    categoryId: "animals",
    categorySlug: "zhivotnye",
    image: "https://basket-41.wbbasket.ru/vol9781/part978180/978180831/images/big/1.webp",
    images: [
      "https://basket-41.wbbasket.ru/vol9781/part978180/978180831/images/big/1.webp",
      "https://basket-41.wbbasket.ru/vol9781/part978180/978180831/images/big/2.webp",
      "https://basket-41.wbbasket.ru/vol9781/part978180/978180831/images/big/3.webp",
      "https://basket-41.wbbasket.ru/vol9781/part978180/978180831/images/big/4.webp",
      "https://basket-41.wbbasket.ru/vol9781/part978180/978180831/images/big/5.webp",
    ],
    description: "Раскраска по номерам «Животные» — природа, гармония и творчество.",
    bestseller: false,
  },
] satisfies Product[];

const productSpecs = [
  "25 картин по номерам",
  "29 страниц",
  "Один альбом-раскраска в комплекте",
  "Возрастные ограничения: 12+ / 14+ в зависимости от товара",
  "Страна производства: Россия",
];

const productHowItWorks =
  "Выберите сюжет, следуйте системе номеров и постепенно заполняйте зоны подходящими цветами. В каждой книге 25 картин, поэтому раскрашивание удобно разбить на короткие спокойные сессии.";

const productHighlights = [
  { id: "delivery", title: "Доставка", description: "Оформление заказа через корзину сайта" },
  { id: "paper", title: "Комплект", description: "Один альбом-раскраска, 29 страниц" },
  { id: "print", title: "Сюжеты", description: "25 картин по номерам в каждой книге" },
] satisfies ProductHighlight[];

export const productsData = {
  categories,
  products,
  productSpecs,
  productHowItWorks,
  productHighlights,
} satisfies ProductsData;
