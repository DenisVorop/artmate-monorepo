export type BlogAuthor = {
  name: string;
  role: string;
  avatar: string;
  bio: string;
};

export type BlogPost = {
  id: string;
  title: string;
  excerpt: string;
  category: string;
  date: string;
  readTime: string;
  image: string;
  tags: string[];
  author: BlogAuthor;
  featured?: boolean;
};

export type BlogPostsData = {
  items: BlogPost[];
};

const AUTHORS = {
  olga: {
    name: "Ольга Миронова",
    role: "Арт-куратор ARTMATE",
    avatar: "ОМ",
    bio: "Помогает собирать материалы и творческие практики в понятные сценарии для спокойного и регулярного раскрашивания.",
  },
  tatiana: {
    name: "Татьяна Орлова",
    role: "Иллюстратор ARTMATE",
    avatar: "ТО",
    bio: "Работает с цветом и композициями для печатных раскрасок, тестирует палитры, бумагу и поведение материалов в реальных сессиях.",
  },
  maria: {
    name: "Мария Соколова",
    role: "Редактор блога ARTMATE",
    avatar: "МС",
    bio: "Собирает практические статьи о материалах, арт-терапии и повседневных ритуалах, которые помогают встроить творчество в обычный график.",
  },
} satisfies Record<string, BlogAuthor>;

export const BLOG_POSTS = [
  {
    id: "color-palettes-for-beginners",
    title: "Как выбрать палитру для\u00a0первой раскраски",
    excerpt:
      "Простой способ собрать 4-6 оттенков, которые смотрятся цельно и\u00a0не\u00a0спорят друг с\u00a0другом.",
    category: "Цвет",
    date: "12 апреля 2026",
    readTime: "6 мин",
    image: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=1200&q=80",
    tags: ["Палитра", "Новичкам", "Цвет"],
    author: AUTHORS.tatiana,
    featured: true,
  },
  {
    id: "markers-vs-pencils",
    title: "Маркеры или\u00a0карандаши: что выбрать",
    excerpt:
      "Разбираем, чем отличаются материалы, где проще контролировать цвет и\u00a0как избежать пятен.",
    category: "Материалы",
    date: "9 апреля 2026",
    readTime: "5 мин",
    image: "https://images.unsplash.com/photo-1452860606245-08befc0ff44b?w=1200&q=80",
    tags: ["Маркеры", "Карандаши", "Материалы"],
    author: AUTHORS.olga,
  },
  {
    id: "calm-evening-ritual",
    title: "Творческий ритуал для\u00a0спокойного вечера",
    excerpt: "Как подготовить место, выбрать сюжет и\u00a0мягко переключиться после рабочего дня.",
    category: "Арт-терапия",
    date: "4 апреля 2026",
    readTime: "4 мин",
    image: "https://images.unsplash.com/photo-1515940175183-6798529cb860?w=1200&q=80",
    tags: ["Ритуалы", "Антистресс", "Арт-терапия"],
    author: AUTHORS.maria,
  },
  {
    id: "paper-density-guide",
    title: "Почему плотность бумаги важна",
    excerpt:
      "Объясняем, как бумага 190 г/м² влияет на\u00a0маркеры, карандаши и\u00a0ощущение от\u00a0работы.",
    category: "Материалы",
    date: "28 марта 2026",
    readTime: "7 мин",
    image: "https://images.unsplash.com/photo-1517971071642-34a2d3ecc9cd?w=1200&q=80",
    tags: ["Бумага", "Материалы", "Практика"],
    author: AUTHORS.tatiana,
  },
  {
    id: "blend-with-pencils",
    title: "Мягкие переходы цветными карандашами",
    excerpt:
      "Пошаговый прием для\u00a0градиентов: от\u00a0легкого нажима до\u00a0финального выравнивания.",
    category: "Техники",
    date: "21 марта 2026",
    readTime: "8 мин",
    image: "https://images.unsplash.com/photo-1497215842964-222b430dc094?w=1200&q=80",
    tags: ["Градиент", "Карандаши", "Техники"],
    author: AUTHORS.olga,
  },
  {
    id: "gift-coloring-book",
    title: "Как выбрать раскраску в\u00a0подарок",
    excerpt:
      "На\u00a0что смотреть: тематика, детализация, формат, материалы и\u00a0настроение будущего владельца.",
    category: "Подарки",
    date: "15 марта 2026",
    readTime: "5 мин",
    image: "https://images.unsplash.com/photo-1513201099705-a9746e1e201f?w=1200&q=80",
    tags: ["Подарки", "Выбор", "Подборка"],
    author: AUTHORS.maria,
  },
] satisfies BlogPost[];

export const blogPostsData = {
  items: BLOG_POSTS,
} satisfies BlogPostsData;
