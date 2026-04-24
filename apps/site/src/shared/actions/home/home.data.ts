import { routes } from "@/shared/constants";

export type HomeHeroMetrics = {
  ratingLabel: string;
  paintedCountLabel: string;
  progressValue: number;
};

export type HomeStepIcon = "book-open" | "brush" | "smile";
export type HomeStepTone = "rose" | "amber" | "violet";

export type HomeHowItWorksStep = {
  num: string;
  icon: HomeStepIcon;
  title: string;
  desc: string;
  chips: string[];
  tone: HomeStepTone;
  href: string;
  cta: string;
};

export type HomeData = {
  heroMetrics: HomeHeroMetrics;
  advantages: string[];
  howItWorksSteps: HomeHowItWorksStep[];
};

const heroMetrics = {
  ratingLabel: "4.9 / 5",
  paintedCountLabel: "30 000+ человек",
  progressValue: 80,
} satisfies HomeHeroMetrics;

const advantages = [
  "Антистресс",
  "Сегментированные иллюстрации",
  "Бумага 190 г/м²",
  "Спиральный переплёт",
  "Идеально для\u00a0маркеров",
  "Расслабление",
  "Творчество",
  "Дзен",
];

const howItWorksSteps = [
  { num: "01", icon: "book-open", title: "Выберите раскраску", desc: "Выберите тематику под\u00a0настроение — от\u00a0уютных сюжетов до\u00a0детализированных пейзажей.", chips: ["25 иллюстраций", "Формат A4", "Металлическая пружина"], tone: "rose", href: routes.catalog, cta: "В\u00a0каталог" },
  { num: "02", icon: "brush", title: "Раскрашивайте по\u00a0номерам", desc: "Каждая зона уже продумана — просто подбирайте оттенки и\u00a0заполняйте рисунок шаг за\u00a0шагом.", chips: ["Плотная бумага 190 г/м²", "Подходит для\u00a0маркеров", "Чёткие контуры"], tone: "amber", href: routes.catalog, cta: "Смотреть" },
  { num: "03", icon: "smile", title: "Наслаждайтесь процессом", desc: "Расслабьтесь, отвлекитесь от\u00a0суеты и\u00a0создайте работу, которая будет радовать вас каждый день.", chips: ["Антистресс", "Творческий отдых", "Уникальный результат"], tone: "violet", href: routes.gallery, cta: "Галерея" },
] satisfies HomeHowItWorksStep[];

export const homeData = {
  heroMetrics,
  advantages,
  howItWorksSteps,
} satisfies HomeData;
