import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import {
  BlogPostStatus as PrismaBlogPostStatus,
  Prisma,
  PrismaClient,
} from "../generated/prisma/client";

const routes = {
  raskraski: "/catalog/raskraski",
};

const authors = {
  olga: {
    slug: "olga-mironova",
    name: "Ольга Миронова",
    role: "Арт-куратор ARTMATE",
    avatar: "ОМ",
    bio: "Помогает собирать материалы и творческие практики в понятные сценарии для спокойного и регулярного раскрашивания.",
  },
  tatiana: {
    slug: "tatiana-orlova",
    name: "Татьяна Орлова",
    role: "Иллюстратор ARTMATE",
    avatar: "ТО",
    bio: "Работает с цветом и композициями для печатных раскрасок, тестирует палитры, бумагу и поведение материалов в реальных сессиях.",
  },
  maria: {
    slug: "maria-sokolova",
    name: "Мария Соколова",
    role: "Редактор блога ARTMATE",
    avatar: "МС",
    bio: "Собирает практические статьи о материалах, арт-терапии и повседневных ритуалах, которые помогают встроить творчество в обычный график.",
  },
} as const;

const categories = {
  color: {
    slug: "color",
    title: "Цвет",
  },
  materials: {
    slug: "materials",
    title: "Материалы",
  },
  artTherapy: {
    slug: "art-therapy",
    title: "Арт-терапия",
  },
  techniques: {
    slug: "techniques",
    title: "Техники",
  },
  gifts: {
    slug: "gifts",
    title: "Подарки",
  },
} as const;

const tagSlugs = {
  "Арт-терапия": "art-therapy",
  Бумага: "paper",
  Выбор: "choice",
  Градиент: "gradient",
  Карандаши: "pencils",
  Маркеры: "markers",
  Материалы: "materials",
  Новичкам: "beginners",
  Палитра: "palette",
  Подарки: "gifts",
  Подборка: "selection",
  Практика: "practice",
  Ритуалы: "rituals",
  Техники: "techniques",
  Цвет: "color",
  Антистресс: "anti-stress",
} as const;

type BlogPostSeed = {
  slug: string;
  title: string;
  excerpt: string;
  categorySlug: keyof typeof categories;
  publishedAt: string;
  readTimeMinutes: number;
  imageUrl: string;
  tags: readonly (keyof typeof tagSlugs)[];
  authorSlug: keyof typeof authors;
  featured?: boolean;
  content?: BlogContent;
};

type BlogContent = {
  schemaVersion: 1;
  blocks: BlogBlock[];
};

type BlogBlock =
  | {
      id: string;
      type: "heading";
      level: 2 | 3;
      text: string;
      anchor?: string;
    }
  | {
      id: string;
      type: "paragraph";
      text: string;
    }
  | {
      id: string;
      type: "image";
      src: string;
      alt: string;
      caption?: string;
    }
  | {
      id: string;
      type: "quote";
      text: string;
      author?: string;
    }
  | {
      id: string;
      type: "highlights";
      items: {
        title: string;
        description: string;
        emoji?: string;
      }[];
    }
  | {
      id: string;
      type: "steps";
      items: {
        title: string;
        description: string;
      }[];
    }
  | {
      id: string;
      type: "cta";
      title: string;
      description: string;
      href: string;
      label: string;
    };

const posts = [
  {
    slug: "color-palettes-for-beginners",
    title: "Как выбрать палитру для первой раскраски",
    excerpt:
      "Простой способ собрать 4-6 оттенков, которые смотрятся цельно и не спорят друг с другом.",
    categorySlug: "color",
    publishedAt: "2026-04-12T09:00:00.000Z",
    readTimeMinutes: 6,
    imageUrl:
      "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=1200&q=80",
    tags: ["Палитра", "Новичкам", "Цвет"],
    authorSlug: "tatiana",
    featured: true,
    content: {
      schemaVersion: 1,
      blocks: [
        {
          id: "why-limited-palette-works",
          type: "heading",
          level: 2,
          text: "Почему ограниченная палитра выглядит собраннее, чем десятки случайных оттенков",
        },
        {
          id: "why-limited-palette-works-p1",
          type: "paragraph",
          text: "Новички часто начинают с желания использовать как можно больше цветов, потому что кажется: чем богаче набор, тем интереснее получится работа. На практике происходит обратное. Большое количество случайных оттенков создаёт визуальный шум, и иллюстрация теряет цельность.",
        },
        {
          id: "why-limited-palette-works-p2",
          type: "paragraph",
          text: "Ограниченная палитра заставляет цвета поддерживать друг друга. Один и тот же оттенок повторяется в разных участках рисунка, между элементами появляется ритм, а глаз воспринимает страницу как единое высказывание, а не набор несвязанных решений.",
        },
        {
          id: "why-limited-palette-works-image",
          type: "image",
          src: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=1200&q=80",
          alt: "Набор цветных карандашей и палитра на столе",
          caption:
            "Когда оттенков немного, легче удерживать единое настроение страницы и не спорить с сюжетом.",
        },
        {
          id: "choose-anchor-color",
          type: "heading",
          level: 2,
          text: "Начните с одного опорного цвета, а не с полного набора",
        },
        {
          id: "choose-anchor-color-p1",
          type: "paragraph",
          text: "Самый надёжный способ собрать первую палитру — выбрать опорный оттенок, который задаст эмоциональный тон работе. Это может быть мягкий оливковый, тёплый розовый, терракотовый или приглушённый голубой. Важно не то, насколько цвет модный, а то, насколько легко вам строить вокруг него соседние решения.",
        },
        {
          id: "choose-anchor-color-p2",
          type: "paragraph",
          text: "Когда опорный цвет уже есть, проще понять, какие оттенки будут его поддерживать, а какие разрушат общее впечатление. Он становится якорем: помогает не расползтись в случайные яркие пятна и сохраняет контроль над страницей даже тогда, когда вы работаете интуитивно.",
        },
        {
          id: "choose-anchor-color-quote",
          type: "quote",
          text: "Первая палитра должна не удивлять количеством, а успокаивать предсказуемостью.",
          author: "Редакция блога ARTMATE",
        },
        {
          id: "build-around-anchor",
          type: "heading",
          level: 2,
          text: "Соберите 4-6 оттенков вокруг базового цвета",
        },
        {
          id: "build-around-anchor-p1",
          type: "paragraph",
          text: "Для первой раскраски не нужен сложный набор. Достаточно выбрать несколько ролей и закрепить за каждым цветом понятную задачу: что будет основой, что даст контраст, а что поможет смягчить композицию.",
        },
        {
          id: "build-around-anchor-highlights",
          type: "highlights",
          items: [
            {
              emoji: "🎯",
              title: "Базовый оттенок",
              description:
                "Главный цвет, который будет повторяться чаще других и удерживать настроение страницы.",
            },
            {
              emoji: "🌤",
              title: "Светлый поддерживающий",
              description:
                "Тон для крупных спокойных зон, чтобы работа не выглядела тяжёлой и перегруженной.",
            },
            {
              emoji: "🌒",
              title: "Тёмный акцент",
              description:
                "Нужен для глубины, контраста и опорных точек, которые ведут взгляд по композиции.",
            },
            {
              emoji: "🌿",
              title: "Нейтральный мостик",
              description:
                "Приглушённый оттенок, который связывает яркие места и помогает смягчить переходы.",
            },
          ],
        },
        {
          id: "test-before-main-page",
          type: "heading",
          level: 2,
          text: "Проверьте палитру на выкраске до того, как начнёте основную страницу",
        },
        {
          id: "test-before-main-page-p1",
          type: "paragraph",
          text: "Даже хорошие сочетания на глаз могут вести себя иначе на бумаге. Один и тот же карандаш рядом с тёплым фоном кажется мягче, а рядом с холодным уходит в серость. Поэтому перед стартом стоит сделать маленькую выкраску на отдельном листе или в углу тестовой страницы.",
        },
        {
          id: "test-before-main-page-p2",
          type: "paragraph",
          text: "Такой быстрый тест снимает лишнее напряжение. Вы заранее понимаете, где сочетание выглядит уверенно, а где стоит заменить один тон на более спокойный. В результате во время основной работы вы меньше сомневаетесь и реже исправляете решения по ходу.",
        },
        {
          id: "test-before-main-page-steps",
          type: "steps",
          items: [
            {
              title: "Сначала протестируйте пары",
              description:
                "Смотрите не только на каждый цвет отдельно, но и на то, как два соседних оттенка работают вместе.",
            },
            {
              title: "Проверьте светлый, средний и тёмный тон",
              description:
                "Даже мягкая палитра должна иметь разницу по насыщенности, иначе рисунок станет плоским.",
            },
            {
              title: "Оставьте немного воздуха",
              description:
                "Не закрашивайте все элементы одинаково плотно. Белые и светлые зоны нужны композиции не меньше цвета.",
            },
            {
              title: "Зафиксируйте итоговый набор",
              description:
                "Отложите выбранные инструменты отдельно, чтобы не менять решения в середине процесса.",
            },
          ],
        },
        {
          id: "repeatable-algorithm",
          type: "heading",
          level: 2,
          text: "Быстрый алгоритм, который можно повторять для любой новой раскраски",
        },
        {
          id: "repeatable-algorithm-p1",
          type: "paragraph",
          text: "Начинайте с настроения, а не с названий цветов. Спросите себя, какой должна быть страница: тёплой, воздушной, спокойной, винтажной. После этого выберите один основной оттенок, добавьте к нему светлый и тёмный, а затем проверьте, нужен ли четвёртый или пятый цвет.",
        },
        {
          id: "repeatable-algorithm-p2",
          type: "paragraph",
          text: "Если палитра выглядит цельно на маленькой выкраске, почти всегда она будет работать и на всей странице. Этот подход экономит время, снижает тревожность и помогает быстрее находить собственный визуальный почерк.",
        },
        {
          id: "practice-cta",
          type: "cta",
          title: "Соберите первую палитру на практике",
          description:
            "Выберите раскраску с крупными формами и протестируйте 4-6 оттенков без лишнего давления на результат.",
          href: routes.raskraski,
          label: "Перейти в каталог",
        },
      ],
    },
  },
  {
    slug: "markers-vs-pencils",
    title: "Маркеры или карандаши: что выбрать",
    excerpt:
      "Разбираем, чем отличаются материалы, где проще контролировать цвет и как избежать пятен.",
    categorySlug: "materials",
    publishedAt: "2026-04-09T09:00:00.000Z",
    readTimeMinutes: 5,
    imageUrl:
      "https://images.unsplash.com/photo-1452860606245-08befc0ff44b?w=1200&q=80",
    tags: ["Маркеры", "Карандаши", "Материалы"],
    authorSlug: "olga",
  },
  {
    slug: "calm-evening-ritual",
    title: "Творческий ритуал для спокойного вечера",
    excerpt:
      "Как подготовить место, выбрать сюжет и мягко переключиться после рабочего дня.",
    categorySlug: "artTherapy",
    publishedAt: "2026-04-04T09:00:00.000Z",
    readTimeMinutes: 4,
    imageUrl:
      "https://images.unsplash.com/photo-1515940175183-6798529cb860?w=1200&q=80",
    tags: ["Ритуалы", "Антистресс", "Арт-терапия"],
    authorSlug: "maria",
  },
  {
    slug: "paper-density-guide",
    title: "Почему плотность бумаги важна",
    excerpt:
      "Объясняем, как бумага 190 г/м² влияет на маркеры, карандаши и ощущение от работы.",
    categorySlug: "materials",
    publishedAt: "2026-03-28T09:00:00.000Z",
    readTimeMinutes: 7,
    imageUrl:
      "https://images.unsplash.com/photo-1517971071642-34a2d3ecc9cd?w=1200&q=80",
    tags: ["Бумага", "Материалы", "Практика"],
    authorSlug: "tatiana",
  },
  {
    slug: "blend-with-pencils",
    title: "Мягкие переходы цветными карандашами",
    excerpt:
      "Пошаговый прием для градиентов: от легкого нажима до финального выравнивания.",
    categorySlug: "techniques",
    publishedAt: "2026-03-21T09:00:00.000Z",
    readTimeMinutes: 8,
    imageUrl:
      "https://images.unsplash.com/photo-1497215842964-222b430dc094?w=1200&q=80",
    tags: ["Градиент", "Карандаши", "Техники"],
    authorSlug: "olga",
  },
  {
    slug: "gift-coloring-book",
    title: "Как выбрать раскраску в подарок",
    excerpt:
      "На что смотреть: тематика, детализация, формат, материалы и настроение будущего владельца.",
    categorySlug: "gifts",
    publishedAt: "2026-03-15T09:00:00.000Z",
    readTimeMinutes: 5,
    imageUrl:
      "https://images.unsplash.com/photo-1513201099705-a9746e1e201f?w=1200&q=80",
    tags: ["Подарки", "Выбор", "Подборка"],
    authorSlug: "maria",
  },
] satisfies BlogPostSeed[];

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: getRequiredEnv("DATABASE_URL"),
  }),
});

async function main() {
  const authorIds = await seedAuthors();
  const categoryIds = await seedCategories();
  const tagIds = await seedTags();

  for (const post of posts) {
    const savedPost = await prisma.blogPost.upsert({
      where: {
        slug: post.slug,
      },
      update: {
        title: post.title,
        excerpt: post.excerpt,
        status: PrismaBlogPostStatus.PUBLISHED,
        featured: post.featured ?? false,
        readTimeMinutes: post.readTimeMinutes,
        imageUrl: post.imageUrl,
        imageAlt: post.title,
        publishedAt: new Date(post.publishedAt),
        content: getPostContent(post) as Prisma.InputJsonValue,
        authorId: authorIds[post.authorSlug],
        categoryId: categoryIds[post.categorySlug],
      },
      create: {
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        status: PrismaBlogPostStatus.PUBLISHED,
        featured: post.featured ?? false,
        readTimeMinutes: post.readTimeMinutes,
        imageUrl: post.imageUrl,
        imageAlt: post.title,
        publishedAt: new Date(post.publishedAt),
        content: getPostContent(post) as Prisma.InputJsonValue,
        authorId: authorIds[post.authorSlug],
        categoryId: categoryIds[post.categorySlug],
      },
    });

    await prisma.blogPostTag.deleteMany({
      where: {
        postId: savedPost.id,
      },
    });
    await prisma.blogPostTag.createMany({
      data: post.tags.map((tagTitle, index) => ({
        postId: savedPost.id,
        tagId: tagIds[tagTitle],
        sortOrder: index,
      })),
    });
  }

  console.log(
    JSON.stringify(
      {
        authors: Object.keys(authors).length,
        categories: Object.keys(categories).length,
        posts: posts.length,
        tags: Object.keys(tagSlugs).length,
      },
      null,
      2,
    ),
  );
}

async function seedAuthors() {
  const result = {} as Record<keyof typeof authors, string>;

  for (const [key, author] of objectEntries(authors)) {
    const savedAuthor = await prisma.blogAuthor.upsert({
      where: {
        slug: author.slug,
      },
      update: author,
      create: author,
    });

    result[key] = savedAuthor.id;
  }

  return result;
}

async function seedCategories() {
  const result = {} as Record<keyof typeof categories, string>;

  for (const [key, category] of objectEntries(categories)) {
    const savedCategory = await prisma.blogCategory.upsert({
      where: {
        slug: category.slug,
      },
      update: category,
      create: category,
    });

    result[key] = savedCategory.id;
  }

  return result;
}

async function seedTags() {
  const result = {} as Record<keyof typeof tagSlugs, string>;

  for (const [title, slug] of objectEntries(tagSlugs)) {
    const savedTag = await prisma.blogTag.upsert({
      where: {
        slug,
      },
      update: {
        title,
      },
      create: {
        slug,
        title,
      },
    });

    result[title] = savedTag.id;
  }

  return result;
}

function getPostContent(post: BlogPostSeed): BlogContent {
  return post.content ?? createFallbackContent(post);
}

function createFallbackContent(post: BlogPostSeed): BlogContent {
  return {
    schemaVersion: 1,
    blocks: [
      {
        id: "summary",
        type: "heading",
        level: 2,
        text: `Коротко о теме «${post.title}»`,
      },
      {
        id: "summary-text",
        type: "paragraph",
        text: post.excerpt,
      },
      {
        id: "practice",
        type: "cta",
        title: "Продолжить практику на новой странице",
        description:
          "Выберите сюжет с понятными формами и сразу примените советы из статьи в реальной работе.",
        href: routes.raskraski,
        label: "Подобрать раскраску",
      },
    ],
  };
}

function objectEntries<T extends object>(value: T) {
  return Object.entries(value) as {
    [K in keyof T]: [K, T[K]];
  }[keyof T][];
}

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
